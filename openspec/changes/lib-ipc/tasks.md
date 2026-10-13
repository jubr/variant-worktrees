## 1. Library package

- [ ] 1.1 Add workspace package `packages/variant-ipc` (strict ESM, Zod v4, `src/*.spec.ts` tests, build scripts matching `variant-config`) and build it from the root `build` script before `variant-vscode`. Verify the package is a workspace member and `bun run --filter variant-ipc build` succeeds.
- [ ] 1.2 Ignore `vscode/*.sock`. Verify `git check-ignore` matches `vscode/variant-worktrees.sock`.

## 2. Path and discovery

- [ ] 2.1 Add failing `variant-ipc` tests for the absolute socket path, parent walk, nearest match, and a missing socket that names `vscode/variant-worktrees.sock`. Verify those tests fail before implementation.
- [ ] 2.2 Implement path resolution and parent-directory discovery without creating the socket file. Verify the tests from 2.1 pass.

## 3. Listener and client

- [ ] 3.1 Add failing `variant-ipc` tests, using real Unix sockets in a temp directory, for owner-only bind, preserved directory mode, stale replace, live-socket refusal, `ping`, unknown method, invalid line, ordered requests, connect-without-create, stop-unlinks, and a failed second listener that leaves the live socket. Verify those tests fail before implementation.
- [ ] 3.2 Implement the newline-delimited JSON listener and client, including `ping`, owner-only socket mode, stale replacement, and unlink-on-stop. Verify the tests from 3.1 pass.

## 4. Extension endpoint

- [ ] 4.1 Add failing `variant-vscode` tests for one workspace folder, two workspace folders, no workspace folder, `ping` from a nested directory, unlink on deactivate, and a live foreign socket that survives deactivate. Verify those tests fail before implementation.
- [ ] 4.2 Start one `variant-ipc` listener per open workspace folder from extension activation and dispose those listeners on deactivation. Bundle `variant-ipc` into the extension. Verify the tests from 4.1 pass.

## 5. Documentation

- [ ] 5.1 Document the socket path and parent-directory discovery in `docs/guide/ipc.md` and link it from the VitePress sidebar. Verify the page states `vscode/variant-worktrees.sock` and that clients walk up from their start directory.

## 6. Validation

- [ ] 6.1 Run `openspec validate --all --strict --no-interactive` and verify `lib-ipc` is valid.
- [ ] 6.2 Run `variant-ipc` and `variant-vscode` tests, then root lint and build. Verify those checks pass.
