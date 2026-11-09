## Why

Package tests sit in two layouts: `packages/*/test/*.test.ts` and colocated `src/*.spec.ts`. `packages/*/test` separates a test from the module it covers, and nothing fails when that directory comes back. `src/test` is a fine place for `setup.ts` and similar helpers, and nothing fails when a test file lands there instead. Cursor-only modules sit in the same `src/` as editor-neutral code, so a Cursor API change is mixed with the rest of the package.

## What Changes

- Move source files whose basename starts with `cursor-` into `packages/<package>/src/cursor/`. Leave every other module in place and update imports. Do not add tests for this move.
- In `chat-renamer-vscode`, also move Cursor-only modules that are not named `cursor-*` (`session-activity`, `active-chat`) into `src/cursor/`, and extract Cursor-only functions from mixed modules (`readComposerActivity`, the `state.vscdb` path, `composer.getOrderedSelectedComposerIds`). Leave extension wiring in place. Do not add tests for this move.
- In `chat-renamer-api`, move `chat-first-prompt`, `chat-rename-hooks`, and `composer-activity` into `src/cursor/`, and extract `resolveCursorDir` and `hookCommand` into `src/cursor/cursor-dir.ts`. In `variant-vscode`, move Cursor MCP register and unregister into `src/cursor/cursor-mcp-server.ts` and leave the VS Code language-model provider in `mcp-registration.ts`. Do not add tests for these moves.
- Move existing package bun tests out of `packages/*/test/` so each test is a sibling of the module it covers: `abc.spec.ts` next to `abc.ts` (or `abc.spec.tsx` next to `abc.tsx`). Rename `*.test.ts` to `*.spec.ts`, including tests that already live under `src/`.
- Add one generic test that fails when `packages/*/test` exists, and that fails when a `.spec.ts` or `.spec.tsx` under `src/**/test` covers a `.ts` or `.tsx` source in that package. A `.test.ts` or `.test.tsx` under that path fails. The same test allows non-test files there, such as `src/test/setup.ts`, and allows a spec there when the package has no `.ts` or `.tsx` source with that stem.
- Move non-test helpers that today live under `packages/*/test/` (preload setup, mocks, support modules) to `src/test/` and remove `packages/*/test`. Point Bun preloads at `src/test/setup.ts`.

## Capabilities

### New Capabilities

- `meta/colocated-tests`: package bun tests are siblings of the source they cover, `packages/*/test` is absent, and the suite fails when a spec under `src/test` covers a `.ts` or `.tsx` source. Helpers in `src/test` stay allowed, and so does a spec there with no such source.

### Modified Capabilities

None. The cursor directory move does not change a product requirement.

## Impact

- Cursor-named sources: `packages/variant-vscode/src/cursor-command-probe.ts`, `packages/variant-vscode/src/cursor-mcp.d.ts`, `packages/chat-renamer-vscode/src/cursor-host.ts`, `packages/chat-renamer-api/src/cursor-chat-rename.ts`, and the imports of those modules.
- Cursor-only `chat-renamer-vscode` modules that are not named `cursor-*`: `session-activity.ts`, `active-chat.ts`, `readComposerActivity`, the `state.vscdb` path beside globalStorage, and `composer.getOrderedSelectedComposerIds`.
- Cursor-only `chat-renamer-api` modules: `chat-first-prompt.ts`, `chat-rename-hooks.ts`, `composer-activity.ts`, and `resolveCursorDir` / `hookCommand` in `cursor-dir.ts`.
- Cursor MCP register and unregister: `packages/variant-vscode/src/cursor/cursor-mcp-server.ts`. `mcp-registration.ts` keeps the VS Code provider.
- Specs with no `.ts` or `.tsx` source: `src/test/` in `variant-vscode`, `variant-ui`, and `chat-renamer-vscode`.
- Test trees to relocate: `packages/variant-api/test/`, `packages/variant-cli/test/`, `packages/variant-config/test/`, `packages/variant-mcp/test/`, `packages/chat-renamer-config/test/`, plus preload and mock files under `packages/variant-vscode/test/`, `packages/variant-ui/test/`, and `packages/chat-renamer-vscode/test/`. In-source `*.test.ts` files rename to `*.spec.ts`. Helpers land in `src/test/`.
- `bunfig.toml` preload paths, package `tsconfig.json` include/exclude entries that name `test`, `AGENTS.md` package tree, and the OpenSpec context line that still says tests live under each package's `test/` directory.
- `scripts/*.spec.ts` stay where they are. `packages/variant-ui/src/testing/` stays (public harness, not `src/test`).

## Non-goals

- A test that asserts Cursor modules live under `src/cursor/`.
- Banning `src/test` when it holds `setup.ts` or similar non-test files.
- Moving `mcp-registration.ts` wholesale. It still registers the VS Code language-model provider. The Cursor register and unregister calls live in `src/cursor/cursor-mcp-server.ts`.
- Changing CLI, MCP, extension, or library behavior.
- Rewriting paths inside archived OpenSpec changes.
- Moving `scripts/*.spec.ts` or renaming `packages/variant-ui/src/testing/`.
