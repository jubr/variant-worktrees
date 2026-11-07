## Context

See [proposal.md](proposal.md) for why. `implode` already stops the runtime, drops data, prints the worktree report, and runs `git worktree remove`. The local branch is left in place (`packages/variant-api/src/operations/implode.ts`). Command arguments are `string`, `number`, or `boolean` (`packages/variant-api/src/commands.ts`). The CLI maps those onto cleye, and the MCP server maps them onto Zod. cleye treats a camelCase flag name as the kebab-case CLI form (`branchRm` → `--branch-rm`). Leveled logs go through `log(level, message)` in `packages/variant-api/src/log.ts`. The report callback on implode is a separate stderr channel and is not a debug event. The default CLI threshold is `warn`.

The merge gate already treats a HEAD contained in `origin/<baseBranch>` as merged, including when the local base branch does not contain it.

## Goals / Non-Goals

**Goals:**

- One branch step at the end of a successful implode, shared by the library, the CLI, MCP, the editor, and the variants page.
- A choice argument whose allowed tokens are data on the command definition, with `yes` and `no` as the first pair.
- A debug event for that step, distinct from the worktree report.

**Non-Goals:**

- See proposal.md. In particular, shell scripts do not complete the tokens `yes` and `no`. `--branch-rm` appears because completion is generated from the command definition, the same way `--log-level` takes a value without listing its tokens.

## Decisions

**Add a `choice` argument type whose `values` are the tokens.** `ArgDefinition` gains `type: "choice"` and `values`. `branchRm` uses `values: ["yes", "no"]` and default `yes`. The CLI registers it as a cleye string flag and rejects a value outside `values` before `execute`. The MCP tool schema is `z.enum(values)`. A later token is a new entry in `values`, plus the behavior for that token. Alternative: a boolean `--branch-rm` / `--no-branch-rm`. Rejected: a boolean cannot grow a third token. Alternative: accept `true` and `false` as aliases of `yes` and `no`. Rejected: two vocabularies for one flag. Presence flags stay booleans.

**Apply the default inside `implode`, not in the CLI.** Omitted `branchRm` means remove. `no` keeps the branch. Any other string fails before teardown and names `yes` and `no`. The editor, the HTTP action, and MCP therefore get the same default without each host passing `yes`. Alternative: default only on the CLI, and keep today's library behavior. Rejected: the button and the tool would keep the branch while the CLI deleted it.

**Delete the local branch with `git branch -D` after the gate, from the primary checkout.** The gate is the safety check. `git branch -d` refuses a branch that is merged only into `origin/<baseBranch>`, which the gate already accepts, so `-d` would fail a successful implode. `-D` runs only after the gate has passed and only when the choice is `yes`. The branch name is `git rev-parse --abbrev-ref HEAD` in the worktree, captured before `git worktree remove`. Detached `HEAD` skips deletion. With no worktree, the name is the first existing `<prefix><slug>` in `variant.branchPrefixes`, the same order `create` uses to reuse a branch. Remote refs are untouched. Alternative: always `-d`, and treat a refusal as success. Rejected: the remote-base case would leave the branch behind. Alternative: delete every prefixed branch for the slug. Rejected: `create` reuses only the first existing one.

**Log with `log("debug", ...)`.** Removed: `removed branch <name>`. Kept: `kept branch <name>`. None: `no branch to remove for <slug>`. The worktree report stays on the report callback. The CLI prefix `debug:` comes from the existing log threshold.

**The result carries `branch` and `branchRemoved`.** The text summary adds `removed branch <name>` only when `branchRemoved` is true. A branch-only cleanup is still an implode, so the summary is not "Nothing to implode".

**Confirmations name the branch and pass no choice.** `ImplodeDialog` and the native tree modal say the branch is removed. Both still call `implode` with confirmation only.

## Risks / Trade-offs

- [Default deletes a local branch the caller wanted to keep] → `--branch-rm=no` and `branchRm: "no"`. The confirmations name the branch before the editor or the page proceeds.
- [Branch delete fails after the worktree is gone] → the error names the branch. A later implode of the same slug has no worktree and still runs the branch step, so a retry can remove it once it is no longer checked out.
- [`-D` deletes a branch git would have kept with `-d`] → `-D` runs only after the merge gate. Unmerged work without `force` never reaches it.
- [A script implodes and then checks out the branch] → breaking. The script passes `--branch-rm=no`.

## Migration Plan

No schema or config migration. After this ships, a successful implode removes the local branch unless the caller passes `no`. Rollback is reverting the change. Branches already left behind by older implodes stay until a later implode of that slug, or until someone deletes them by hand.

## Open Questions

None.
