## Why

`switch` calls `process.chdir()` on the process that runs it. A `variant switch` in the CLI changes the directory of a short-lived child process and has no effect on the user's shell. `variant_switch` over MCP moves the server's own working directory, which silently changes what later tool calls resolve against. The command does nothing useful for its callers and carries a hazard, while `create` and `provision` already ensure the `_v-*` worktree.

## What Changes

- **BREAKING** Remove the `switch` command: the CLI subcommand, the MCP tool `variant_switch`, the webview form, and the library method `client.switch()`.
- **BREAKING** Remove the library exports `switchWorktree` and `switchVariant`; `ensureWorktree` stays and is what `create` and `provision` use.
- The extension's list of refused lifecycle commands drops `switch`. A socket request named `switch` fails as an unknown command, as any other unknown name does.
- Specs, docs, README, and `AGENTS.md` stop mentioning `switch`.
- The worktree-coupling requirement no longer claims the process switches into the new worktree on `create`; `create` ensures the worktree and leaves the working directory alone.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `variant-api/commands`: `switch` leaves the shared command list and the in-process execution requirement; a removed command reports as unknown.
- `variant-api/core`: worktree coupling drops the process switch.
- `variant-mcp/tools`: the `variant_switch` tool is removed.
- `variant-vscode/ipc-endpoint`: `switch` leaves the list of refused lifecycle commands.

## Impact

- `packages/variant-api`: `src/commands.ts`, `src/types.ts`, `src/index.ts`, `src/worktree.ts`, `src/operations/switch.ts` (deleted), and the tests in `test/operations.test.ts`, `test/commands.test.ts`.
- `packages/variant-mcp`: `test/mcp.test.ts` (tool list is derived from the command definitions).
- `packages/variant-vscode`: `src/extension.ts`.
- Docs: `README.md`, `AGENTS.md`, `docs/mcp.md`, `docs/cli-vscode-webview.md`, `docs/guide/core.md`, `docs/guide/ipc.md`, `docs/guide/library.md`; `CHANGELOG.md` records the removal.
- Specs: [specs/variant-api/commands](../../specs/variant-api/commands/spec.md), [specs/variant-api/core](../../specs/variant-api/core/spec.md), [specs/variant-mcp/tools](../../specs/variant-mcp/tools/spec.md), [specs/variant-vscode/ipc-endpoint](../../specs/variant-vscode/ipc-endpoint/spec.md).

## Non-goals

- No replacement command. Users `cd` to the path that `create` returns.
- Archived changes keep their historical mention of `switch`.
- Git `switch` used inside tests and unrelated uses of the word (JS `switch`, the chat renamer being "switched off", the docs appearance switch) stay.
