## Context

`createListener` in `packages/variant-ipc/src/index.ts` binds `variant-worktrees.sock`. `stop()` awaits `server.close()` and then `unlinkSync`. The extension calls `stopSockets()` from `deactivate()` and from a context subscription; the host gives `deactivate()` a limited time and may exit the process regardless. See proposal.md for the motivation.

Facts that shape the choice, checked on Node and Bun:

- The kernel offers no bind flag or socket option that unlinks a filesystem socket on close.
- libuv does it: calling `server.close()` on a path-bound server unlinks that path immediately, while clients are still connected. The `close` callback, however, waits for every connection to end. So today a clean stop already removes the file, but the `stop()` promise hangs on a connected client.
- libuv unlinks the path unconditionally on close, so a different file that now sits at the path is also removed by it. Protecting such a file on `stop()` is not possible without renaming files around `close()`.
- Unlinking right after `listen` leaves a working listener that nobody can connect to by path.
- Linux abstract sockets (`\0name`) vanish on close but are Linux-only, have no filesystem path, and do not work on macOS, the primary host.
- `process.on("exit")` handlers must be synchronous and run on normal exit and `process.exit()`, not on SIGKILL or a crash. libuv's unlink does not run there, because no close happens.

## Goals / Non-Goals

**Goals:**

- Every exit path that lets JavaScript run removes the file.
- An open client connection never blocks `stop()` or deactivation.
- The exit hook never removes a file this listener did not bind.

**Non-Goals:**

- Cleaning up after SIGKILL or a crash. The stale-socket check on the next start already replaces the leftover, and clients fail cleanly with a connect error.
- Protecting a successor's file from libuv's unlink during `stop()`. That race needs an external removal of the file first and is not reachable in normal use.
- A new path, option, or setting.

## Decisions

1. **Destroy connections instead of waiting.** `stop()` tracks accepted connections in a `Set<Socket>` (`net.Server` has no `closeAllConnections`), destroys them, then awaits `server.close()`. Alternative: keep waiting with a timeout. Rejected: the wait is spent inside the host's deactivation budget for no benefit.
2. **Keep the explicit unlink in `stop()`.** The file removal does not rely on libuv's behavior; it is done before `close()`, ignoring a missing file.
3. **Ownership check by inode for the exit hook.** After `listen`, the listener records `dev` and `ino` of the socket file via `statSync`. The exit hook unlinks only when the path still has that `dev`/`ino`, so it never removes a file bound by someone else. Alternative: a PID file next to the socket. Rejected: a second artifact to clean up, which is the problem being solved.
4. **Synchronous exit hook inside `createListener`.** `start()` registers `process.once("exit", hook)` after a successful bind; `stop()` and a failed start remove it. The library owns it, so the CLI, tests, and the extension get the same behavior and the extension needs no extra code. The hook only does the ownership check and `unlinkSync`, ignoring `ENOENT`.
5. **No signal handlers.** A `SIGTERM`/`SIGHUP` handler in the extension host would replace Node's default termination and could keep the host alive or change its exit code. The host's own shutdown path ends in a normal exit, which the `exit` hook covers.
6. **Deactivate does not change shape.** `stopSockets()` already awaits each `stop()`; the non-blocking `stop()` is what fixes deactivation with a connected client.

Rejected alternatives: abstract sockets (platform-specific, breaks the path contract), a detached watchdog process that unlinks after the host dies (a second long-lived process, and the file is harmless when stale), socket in `os.tmpdir()` (changes the documented path and the discovery contract), rename-around-close to protect a successor (races clients for no realistic gain).

## Risks / Trade-offs

- [Exit hook runs after a successor bound the same path] → ownership check by `dev`/`ino`; covered by a scenario.
- [Destroying connections drops an in-flight response] → only during shutdown, and clients already handle a closed socket as a failed request.
- [`statSync` fails right after bind] → treat as not owned: skip removal rather than risk removing a foreign file.
- [SIGKILL still leaves a file] → accepted, see Non-Goals.
