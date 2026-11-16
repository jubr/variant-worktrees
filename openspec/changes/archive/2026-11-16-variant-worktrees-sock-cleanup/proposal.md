## Why

`.vscode/variant-worktrees.sock` can stay behind after the editor closes. The kernel has no flag that unlinks a Unix socket file when its owner goes away (macOS and Linux); only Linux abstract sockets vanish on close, and they have no path, so the documented socket path and the CLI client could not use them. What does exist is libuv: closing a Node or Bun `net.Server` that is bound to a path unlinks that path, immediately and whether or not clients are still connected (verified on Node and Bun). So a clean `stop()` already removes the file. Two gaps remain:

- `stop()` awaits `server.close()`, whose callback only fires after every open connection has ended. One lingering client (a CLI that never closed its connection) makes `stop()`, and with it `deactivate()`, hang until the host gives up and kills the process.
- Nothing runs when the extension host exits without reaching `server.close()` (deactivation timeout or `process.exit`, window close racing the host). libuv only unlinks on close, so the file stays.

A killed or crashed host (SIGKILL) cannot clean up by any means. The existing stale-socket check already replaces that leftover on the next start, so it stays a harmless file; this change makes every other exit path clean.

## What Changes

- `stop()` destroys connections that are still open instead of waiting for them, so it completes and the editor's deactivation does not hang on a connected client.
- A listener that is bound removes its socket file synchronously when the process exits without `stop()` having run, but only while the path is still the file that listener bound. `stop()` detaches that hook.
- No new flag, option, command, or setting. The socket path, mode, and request format stay as they are.

Out of scope, considered and rejected in design: abstract sockets, a watchdog process, moving the socket to the OS temp directory, signal handlers in the extension host, protecting a successor's file from libuv's unlink on close.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `variant-ipc/unix-socket`: stopping completes and removes the socket even while a client is connected; a process exit without `stop()` also removes it, leaving a different file at that path alone; a killed process leaves a file the next listener replaces.
- `variant-vscode/ipc-endpoint`: deactivation completes and removes the socket even while a client is connected.

## Impact

- `packages/variant-ipc/src/index.ts` (`createListener`) and `socket.spec.ts`.
- `packages/variant-vscode/src/ipc.ts` and `ipc.spec.ts` (deactivate with a connected client).
- `CHANGELOG.md` (`Unreleased`, Changed), `packages/variant-vscode/CHANGELOG.md` if it tracks extension behavior.
- [specs/variant-ipc/unix-socket](../../specs/variant-ipc/unix-socket/spec.md), [specs/variant-vscode/ipc-endpoint](../../specs/variant-vscode/ipc-endpoint/spec.md).
- No documentation change beyond the changelog: no command, flag, output format, or configuration key is added.
