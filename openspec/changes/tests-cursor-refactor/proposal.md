## Why

Package tests sit in two layouts: `packages/*/test/*.test.ts` and colocated `src/*.spec.ts`. `packages/*/test` separates a test from the module it covers, and nothing fails when that directory comes back. `src/test` is a fine place for `setup.ts` and similar helpers, and nothing fails when a test file lands there instead. Cursor-only modules sit in the same `src/` as editor-neutral code, so a Cursor API change is mixed with the rest of the package.

## What Changes

- Move source files whose basename starts with `cursor-` into `packages/<package>/src/cursor/`. Leave every other module in place and update imports. Do not add tests for this move.
- Move existing package bun tests out of `packages/*/test/` so each test is a sibling of the module it covers: `abc.spec.ts` next to `abc.ts` (or `abc.spec.tsx` next to `abc.tsx`). Rename `*.test.ts` to `*.spec.ts`, including tests that already live under `src/`.
- Add one generic test that fails when `packages/*/test` exists, and that fails when a bun test file (`*.spec.ts`, `*.spec.tsx`, `*.test.ts`, or `*.test.tsx`) exists under `src/**/test/` (including `src/test`). The same test allows non-test files there, such as `src/test/setup.ts`.
- Move non-test helpers that today live under `packages/*/test/` (preload setup, mocks, support modules) to `src/test/` and remove `packages/*/test`. Point Bun preloads at `src/test/setup.ts`.

## Capabilities

### New Capabilities

- `meta/colocated-tests`: package bun tests are siblings of the source they cover, `packages/*/test` is absent, and the suite fails when a test file sits under `src/test`. Helpers in `src/test` stay allowed.

### Modified Capabilities

None. The cursor directory move does not change a product requirement.

## Impact

- Cursor-named sources: `packages/variant-vscode/src/cursor-command-probe.ts`, `packages/variant-vscode/src/cursor-mcp.d.ts`, `packages/chat-renamer-vscode/src/cursor-host.ts`, `packages/chat-renamer-api/src/cursor-chat-rename.ts`, and the imports of those modules.
- Test trees to relocate: `packages/variant-api/test/`, `packages/variant-cli/test/`, `packages/variant-config/test/`, `packages/variant-mcp/test/`, `packages/chat-renamer-config/test/`, plus preload and mock files under `packages/variant-vscode/test/`, `packages/variant-ui/test/`, and `packages/chat-renamer-vscode/test/`. In-source `*.test.ts` files rename to `*.spec.ts`. Helpers land in `src/test/`.
- `bunfig.toml` preload paths, package `tsconfig.json` include/exclude entries that name `test`, `AGENTS.md` package tree, and the OpenSpec context line that still says tests live under each package's `test/` directory.
- `scripts/*.spec.ts` stay where they are. `packages/variant-ui/src/testing/` stays (public harness, not `src/test`).

## Non-goals

- A test that asserts Cursor modules live under `src/cursor/`.
- Banning `src/test` when it holds `setup.ts` or similar non-test files.
- Splitting a mixed module that is not named `cursor-*` (for example `mcp-registration.ts`, which registers both the Cursor MCP server and the VS Code language-model provider).
- Changing CLI, MCP, extension, or library behavior.
- Rewriting paths inside archived OpenSpec changes.
- Moving `scripts/*.spec.ts` or renaming `packages/variant-ui/src/testing/`.
