## Context

`createListener` in `packages/variant-ipc/src/index.ts` binds `variant-worktrees.sock`. `stop()` awaits `server.close()` and then `unlinkSync`. `server.close()` resolves only after all connections end. The extension calls `stopSockets()` from `deactivate()` and from a context subscription; the host gives `deactivate()` a limited time and may exit the process regardless. See proposal.md for the motivation.

Facts that shape the choice:

- Neither macOS nor Linux offers a bind flag or socket option that unlinks a filesystem socket on close. Node's `net` does not unlink on close either.
- Unlinking right after `listen` leaves a working listener that nobody can connect to by path.
- Linux abstract sockets (`\0name`) vanish on close but are Linux-only, have no filesystem path, and do not work on macOS, the primary host.
- `process.on("exit")` handlers must be synchronous and run on normal exit and `process.exit()`, not on SIGKILL or a crash.

## Goals / Non-Goals

**Goals:**

- Every exit path that lets JavaScript run removes the file.
- An open client connection never blocks removal.
- Never remove a file this listener does not own.

**Non-Goals:**

- Cleaning up after SIGKILL or a crash. The stale-socket check on the next start already replaces the leftover, and clients fail cleanly with a connect error.
- A new path, option, or setting.

## Decisions

1. **Unlink first, then close.** `stop()` unlinks the path, destroys tracked connections, then awaits `server.close()`. Unlinking first means a host that dies mid-stop has already removed the file. Alternative: keep close-then-unlink and time out. Rejected: the delay is spent inside the host's deactivation budget for no benefit.
2. **Track connections.** `net.Server` has no `closeAllConnections`; the listener keeps a `Set<Socket>` and destroys it on stop.
3. **Ownership check by inode.** After `listen`, the listener records `dev` and `ino` of the socket file via `statSync`. Unlink, in both `stop()` and the exit hook, runs only when the path still has that `dev`/`ino`. This implements "do not remove a successor's file" without a lock file. Alternative: a PID file next to the socket. Rejected: a second artifact to clean up, which is the problem being solved.
4. **Synchronous exit hook inside `createListener`.** `start()` registers `process.once("exit", hook)` after a successful bind; `stop()` and a failed start remove it. The library owns it, so the CLI, tests, and the extension get the same behavior and the extension needs no extra code. The hook only does the ownership check and `unlinkSync`, ignoring `ENOENT`.
5. **No signal handlers.** A `SIGTERM`/`SIGHUP` handler in the extension host would replace Node's default termination and could keep the host alive or change its exit code. The host's own shutdown path ends in a normal exit, which the `exit` hook covers.
6. **Deactivate does not change shape.** `stopSockets()` already awaits each `stop()`; the faster, non-blocking `stop()` is what fixes deactivation with a connected client.

Rejected alternatives: abstract sockets (platform-specific, breaks the path contract), a detached watchdog process that unlinks after the host dies (a second long-lived process, and the file is harmless when stale), socket in `os.tmpdir()` (changes the documented path and the discovery contract).

## Risks / Trade-offs

- [Exit hook runs after a successor bound the same path] → ownership check by `dev`/`ino`; covered by a scenario.
- [Destroying connections drops an in-flight response] → only during shutdown, and clients already handle a closed socket as a failed request.
- [`statSync` fails right after bind] → treat as not owned: skip removal rather than risk removing a foreign file.
- [SIGKILL still leaves a file] → accepted, see Non-Goals.
