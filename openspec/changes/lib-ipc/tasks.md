## 1. Library package

- [x] 1.1 Add workspace package `packages/variant-ipc` (strict ESM, Zod v4, `src/*.spec.ts` tests, build scripts matching `variant-config`) and build it from the root `build` script before `variant-vscode`. Verify the package is a workspace member and `bun run --filter variant-ipc build` succeeds.
- [x] 1.2 Ignore `.vscode/variant-worktrees.sock`. Verify `git check-ignore` matches that path.

## 2. Socket resolution

- [x] 2.1 Add failing `variant-config` tests for `resolveMainVscodeDir`: symlink-container layout from `_v-lib-ipc`, a nested path, the container root, and the main checkout; single-repo layout from the worktree, a nested path, and the repo root; a package `.vscode` without `settings.json` loses to the main `.vscode`; a worktree `.vscode/settings.json` still loses. Verify those tests fail before implementation.
- [x] 2.2 Implement `resolveMainVscodeDir` in `variant-config` using the existing variant-root rules, with `settings.json` only as a tie-break against a package-local `.vscode`. Do not create the directory and do not append `variant-worktrees.sock`. Verify the tests from 2.1 pass.

## 3. Listener and client

- [x] 3.1 Add failing `variant-ipc` tests, using real Unix sockets in a temp directory, for owner-only bind, preserved directory mode, stale replace, live-socket refusal, a `{name, args}` editor request, handler failure, invalid line, two ordered requests, connect-without-create, stop-unlinks, and a failed second listener that leaves the live socket. Verify the tests do not call `variant-api` and fail before implementation.
- [x] 3.2 Implement the newline-delimited JSON listener and client, including the handler call for `{name, args}`, raw success JSON, `error.message` failures, owner-only socket mode, stale replacement, and unlink-on-stop. Do not depend on `variant-api`. Verify the tests from 3.1 pass.

## 4. Extension endpoint

- [x] 4.1 Add failing `variant-vscode` tests for the symlink-container worktree, the main checkout, the single-repo worktree, two folders that share one socket, no workspace folder, `create` and `list` refused without calling `variant-api`, unlink on deactivate, and a live foreign socket that survives deactivate. Verify those tests fail before implementation.
- [x] 4.2 Bind the `variant-config` path from extension activation and share one listener per resolved path. Refuse lifecycle command names. Bundle `variant-ipc` and `variant-config` into the extension. Verify the tests from 4.1 pass.

## 5. Documentation

- [x] 5.1 Document `resolveMainVscodeDir`, the socket file `variant-worktrees.sock` inside that directory, both directory layouts, and that lifecycle commands stay in `variant-api` while editor requests use `{name, args}` on the socket. Link the page from the VitePress sidebar. Verify the page states that split and both layouts.

## 6. Validation

- [x] 6.1 Run `openspec validate --all --strict --no-interactive` and verify `lib-ipc` is valid.
- [x] 6.2 Run `variant-config`, `variant-ipc`, and `variant-vscode` tests, then root lint and build. Verify those checks pass.
