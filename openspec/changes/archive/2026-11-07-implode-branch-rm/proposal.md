## Why

`implode` retires the worktree, the database, and the storage, then leaves the variant's git branch behind. A finished variant still has a local branch to delete by hand. The flag that controls that last step needs a token set that can grow, which a boolean `true`/`false` does not.

## What Changes

- **BREAKING** `implode` removes the variant's local git branch as its last step. The default is to remove it. `--branch-rm=no` keeps the branch, which is today's behavior. `--branch-rm=yes` is the explicit form of the default.
- The flag value is the choice `yes` or `no`. `true` and `false` are rejected. Omitted, the choice is `yes`.
- Choice flags prefer `yes`|`no` over `true`|`false`. The allowed tokens live on the command definition, so a later token can be added without turning the flag into a boolean. Existing on/off flags (`force`, `detach`, `verbose`, `reprovision`) stay booleans.
- A debug log event records the branch name and whether it was removed or kept. The default log threshold stays `warn`, so the line appears with `--log-level=debug` (or a louder trace threshold).
- The implode text summary names a removed branch. The editor tree and the variants page say in their implode confirmation that the branch is removed. Both call `implode` without the flag, so they use the default `yes`.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `variant-api/implode`: after the worktree step, remove the local branch unless `branchRm` is `no`. Default `yes`. Debug log names the branch and the outcome. A refusal still leaves the branch.
- `variant-api/commands`: `implode` takes choice `branchRm` (`yes`|`no`, default `yes`), exposed as `--branch-rm`. Choice flags use `yes`|`no` and reject `true`|`false`.
- `variant-mcp/tools`: `variant_implode` accepts optional `branchRm` of `yes` or `no` and, when it is omitted, removes the local branch.
- `variant-ui/variants-view`: the implode confirmation also says the branch is removed.
- `variant-vscode/variants-tree`: the native implode modal also says the branch is removed.

## Impact

- `variant-api` implode, the shared command definition, the CLI flag parser, MCP tool input, text output, and the debug log.
- README, `docs/guide/core.md`, `docs/guide/library.md`, `docs/guide/configuration.md`, `docs/mcp.md`, `CHANGELOG.md`, and the one-line implode description in `AGENTS.md`.
- Tests that assume the branch still exists after a successful implode.
- Shell completion gains `--branch-rm` because it is derived from the command definition. Completing the tokens `yes` and `no` is out of scope.

## Non-goals

- Deleting a remote branch, or pushing a branch deletion.
- Rewriting existing boolean flags onto `yes`|`no`.
- A third token besides `yes` and `no`. The choice type is what makes a later token possible.
- A control in the editor, the variants page, or `POST /api/variants/<slug>/implode` to pass `no`. Those callers keep the default.
- Changing the merge gate, `--force`, or the worktree report.
