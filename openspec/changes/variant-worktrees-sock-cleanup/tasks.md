## 1. Stop never blocks on clients

- [ ] 1.1 Add failing tests in `packages/variant-ipc/src/socket.spec.ts` for [specs/variant-ipc/unix-socket | Stopping the listener removes its socket](../../specs/variant-ipc/unix-socket/spec.md#requirement-stopping-the-listener-removes-its-socket): stop with an open client connection completes, removes the file, and closes the client; stop after the file was removed and re-bound by a second listener leaves the second file in place. Verify `bun test packages/variant-ipc` fails first.
- [ ] 1.2 In `createListener`: track connections, record `dev`/`ino` after bind, and make `stop()` unlink (ownership-checked) before destroying connections and awaiting `close()`. Verify `bun test packages/variant-ipc` passes.

## 2. Process exit hook

- [ ] 2.1 Add failing tests for [specs/variant-ipc/unix-socket | Process exit removes the socket](../../specs/variant-ipc/unix-socket/spec.md#requirement-process-exit-removes-the-socket) in `packages/variant-ipc/src/socket.spec.ts` using a child process: exit without stop removes the file; exit after stop leaves a successor's socket; SIGKILL leaves a file that a new listener replaces; `process.listenerCount("exit")` returns to its start value after `stop()`. Verify they fail first.
- [ ] 2.2 Register the synchronous, ownership-checked `exit` hook after a successful bind and detach it in `stop()` and on a failed start. Verify `bun test packages/variant-ipc` passes.

## 3. Extension deactivation

- [ ] 3.1 Add a failing test in `packages/variant-vscode/src/ipc.spec.ts` for [specs/variant-vscode/ipc-endpoint | Deactivation removes sockets this activation bound](../../specs/variant-vscode/ipc-endpoint/spec.md#requirement-deactivation-removes-sockets-this-activation-bound): with a client connected, `stopSockets()` resolves and the file is gone. Verify it fails first, then passes with the task 1.2 change and no extension code change. If it needs one, make the smallest change in `packages/variant-vscode/src/ipc.ts`.

## 4. Changelog and gates

- [ ] 4.1 Add `## Unreleased` / `### Changed` in `CHANGELOG.md` (and `packages/variant-vscode/CHANGELOG.md` if it records extension behavior) describing the socket file removal on stop with open clients and on process exit. Verify the entry is present.
- [ ] 4.2 Run `task lint`, `task test`, `task build`, `openspec validate --all --strict --no-interactive` and verify all pass.
