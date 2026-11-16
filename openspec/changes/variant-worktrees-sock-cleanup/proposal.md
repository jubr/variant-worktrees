## Why

`.vscode/variant-worktrees.sock` stays behind after the editor closes. A Unix domain socket file is not released when its owner goes away: macOS and Linux have no flag that makes the kernel unlink it (only Linux abstract sockets vanish on close, and those have no path, so the documented socket path and the CLI client could not use them). Cleanup therefore has to be done by the listener, and today it has two gaps:

- `stop()` waits for `server.close()` before it unlinks. `close()` only completes once every open connection has ended, so one lingering client (a CLI that never closed its connection) stops the unlink from ever running before the extension host is killed.
- Nothing runs when the extension host exits without a clean `deactivate()` (deactivation timeout, `process.exit`, window close racing the host). Only `deactivate()` and the context `dispose` call `stop()`.

A killed or crashed host (SIGKILL) cannot clean up by any means. The existing stale-socket check already replaces that leftover on the next start, so it stays a harmless file; this change makes every other exit path clean.

## What Changes

- `stop()` removes the socket file first, then closes the server and destroys connections that are still open, so an open client connection cannot delay or prevent the removal.
- `stop()` and the exit hook remove the path only when it is still the file this listener bound. A path that was removed and re-bound by another listener is left alone.
- A listener that is bound removes its socket file synchronously when the process exits without `stop()` having run. `stop()` detaches that hook.
- No new flag, option, command, or setting. The socket path, mode, and request format stay as they are.

Out of scope, considered and rejected in design: abstract sockets, a watchdog process, moving the socket to the OS temp directory, signal handlers in the extension host.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `variant-ipc/unix-socket`: stopping removes the socket even while a client is connected and never removes another listener's file; a process exit without `stop()` also removes it; a killed process leaves a file the next listener replaces.
- `variant-vscode/ipc-endpoint`: deactivation completes and removes the socket even while a client is connected.

## Impact

- `packages/variant-ipc/src/index.ts` (`createListener`) and `socket.spec.ts`.
- `packages/variant-vscode/src/ipc.ts` and `ipc.spec.ts` (deactivate with a connected client).
- `CHANGELOG.md` (`Unreleased`, Changed), `packages/variant-vscode/CHANGELOG.md` if it tracks extension behavior.
- [specs/variant-ipc/unix-socket](../../specs/variant-ipc/unix-socket/spec.md), [specs/variant-vscode/ipc-endpoint](../../specs/variant-vscode/ipc-endpoint/spec.md).
- No documentation change beyond the changelog: no command, flag, output format, or configuration key is added.
