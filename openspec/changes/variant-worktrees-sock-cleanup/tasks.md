## 1. Stop never blocks on clients

- [ ] 1.1 Add a failing test in `packages/variant-ipc/src/socket.spec.ts` for [specs/variant-ipc/unix-socket | Stopping the listener removes its socket](../../specs/variant-ipc/unix-socket/spec.md#requirement-stopping-the-listener-removes-its-socket): stop with an open client connection completes, removes the file, and closes the client. Verify `bun test packages/variant-ipc` fails first.
- [ ] 1.2 In `createListener`: track connections and make `stop()` unlink, destroy them, and then await `close()`. Verify `bun test packages/variant-ipc` passes.

## 2. Process exit hook

- [ ] 2.1 Add failing tests for [specs/variant-ipc/unix-socket | Process exit removes the socket](../../specs/variant-ipc/unix-socket/spec.md#requirement-process-exit-removes-the-socket) in `packages/variant-ipc/src/socket.spec.ts` using a child process: exit without stop removes the file; exit after a replaced file leaves the other server's socket; exit after stop removes nothing; SIGKILL leaves a file that a new listener replaces. Verify they fail first.
- [ ] 2.2 Record `dev`/`ino` after bind and register the synchronous, ownership-checked `exit` hook after a successful bind; detach it in `stop()` and on a failed start. Verify `bun test packages/variant-ipc` passes.

## 3. Extension deactivation

- [ ] 3.1 Add a failing test in `packages/variant-vscode/src/ipc.spec.ts` for [specs/variant-vscode/ipc-endpoint | Deactivation removes sockets this activation bound](../../specs/variant-vscode/ipc-endpoint/spec.md#requirement-deactivation-removes-sockets-this-activation-bound): with a client connected, `deactivate()` resolves and the file is gone. Verify it fails first, then passes with the task 1.2 change and no extension code change. If it needs one, make the smallest change in `packages/variant-vscode/src/ipc.ts`.

## 4. Changelog and gates

- [ ] 4.1 Add `## Unreleased` / `### Changed` in `CHANGELOG.md` (and `packages/variant-vscode/CHANGELOG.md` if it records extension behavior) describing stop with open clients and the socket file removal on process exit. Verify the entry is present.
- [ ] 4.2 Run `task lint`, `task test`, `task build`, `openspec validate --all --strict --no-interactive` and verify all pass.
