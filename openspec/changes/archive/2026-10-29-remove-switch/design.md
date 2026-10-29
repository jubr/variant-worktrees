## Context

`switch` is defined once in `packages/variant-api/src/commands.ts` and fans out from there: the CLI subcommand, the MCP tool `variant_switch`, and the webview form are all derived from the command list. `client.switch()` calls `switchVariant` (`operations/switch.ts`), which calls `switchWorktree` (`worktree.ts`): `ensureWorktree` plus `process.chdir`. `create` and `provision` call `ensureWorktree` directly, so the worktree behavior survives without `switchWorktree`. See proposal.md for the motivation.

## Goals / Non-Goals

**Goals:**

- Delete the command, its operation, its client method, and its worktree helper, so no dead code stays.
- Leave `ensureWorktree` and all of `create`, `provision`, `implode` untouched.

**Non-Goals:**

- A replacement such as a `path` command. The `create` result already holds the worktree path.
- Deprecation period. The project is `0.0.x`; the removal is called out as breaking in the changelog.

## Decisions

**Delete rather than deprecate.** The command has no working caller: in the CLI the `chdir` dies with the process, and over MCP it is harmful. A deprecation shim would keep the hazard alive. Alternative: keep the command and drop only `chdir`; rejected because what remains is `ensureWorktree`, which `create` already offers.

**Remove `switchWorktree` from the public exports.** It is exported from `variant-api/src/index.ts` only for the removed operation, and its sole behavior beyond `ensureWorktree` is the `chdir` being removed. Alternative: keep the export for library users; rejected because a library user can call `process.chdir(ensureWorktree(...))` explicitly, which makes the side effect visible.

**The extension keeps refusing unknown names.** Removing `switch` from its refused-lifecycle set means a socket request named `switch` now fails with `unsupported editor request: switch` instead of `switch is not handled on the extension socket`. Both are errors with a non-empty `error.message`; no spec scenario pins the `switch` text.

**Spec the "no chdir" guarantee in `variant-api/core`.** The worktree-coupling requirement claimed that `create` switches the process into the new worktree, which the code never did (`create` calls `ensureWorktree`). The delta corrects the text and adds a no-chdir scenario so a future `chdir` fails a test.

**Tests follow the TDD order.** The test that calls `client.switch("main")` is removed; the command-list tests (`commands.test.ts`, `mcp.test.ts`) drop `switch` / `variant_switch` and gain an assertion that they are absent.

## Risks / Trade-offs

- [Library or MCP users call `switch`] → Breaking change is marked in the changelog and the proposal; the failure is an explicit unknown command or missing tool, not silent misbehavior.
- [A doc or spec keeps a stale mention] → The final task greps the repository for `switch` outside archived changes and unrelated uses, and `openspec validate --all --strict` runs on the result.
