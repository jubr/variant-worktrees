## Context

See proposal.md for why a caller names the start commit. Today `ensureWorktree` always passes `variant.baseBranch` as the last argument of `git worktree add -b`. `create` and `provision` call it directly. `up` and `watch` call it through `prepareVariant` → `createVariant`. The four commands are one `CommandDefinition` each, and the CLI, MCP tools, and generated forms read those definitions.

## Goals / Non-Goals

**Goals:**

- One optional start commit, threaded from the command argument to the `git worktree add -b` start point.
- Resolve that commit before git creates a branch, so a bad name leaves nothing behind.
- Keep `create(slug)` and the existing option objects valid for current callers.

**Non-Goals:**

- Fetching remotes to make `from` resolve.
- A second config key for the start commit. `variant.baseBranch` stays the default start and the implode merge base.
- A prompt on the Explorer **Create variant** action.

## Decisions

### Per-call option, not configuration

`from` is an argument of the operation that creates the branch. `variant.baseBranch` remains the default when the argument is absent, and it remains the branch implode checks.

Alternative: a `variants.yaml` key for the start of the next variant. Rejected. The start is chosen for one slug at creation time, and a file setting would also look like it retargets implode.

### Reuse wins

An existing worktree for the slug, or an existing branch under any configured prefix, is checked out as it is. `from` is not an error in that case and does not reset the branch.

Alternative: fail when `from` is set and the branch already points elsewhere. Rejected. `create` and `watch` are safe to repeat today; a second call with a different `from` must not move work.

### Resolve, then add

Before `git worktree add -b`, resolve `from` to a commit with git in the target repository. Pass that commit as the start point. A name git cannot resolve fails with no new branch and no new directory.

`HEAD` and other relative names use the process working directory when that directory is a worktree of the target repository. Otherwise they use `variant.main`. A full commit id, tag, or branch name does not depend on that choice.

Alternative: let `git worktree add` fail and delete anything it left. Rejected. A preflight keeps the failure path the same as today's missing-path error: nothing was created.

### Second argument on `create`

`create(slug?: string, options?: { from?: string })`. `provision`, `up`, and `watch` gain `from` on the options object they already take. The command definitions map the string argument through.

Alternative: `create({ slug, from })`. Rejected. Every current caller passes a slug string.

### No short flag

The CLI flag is `--from` only. `-f` stays unassigned so it is not read as `--force`.

## Risks / Trade-offs

- [A branch started off `variant.baseBranch` fails implode until it is merged or `--force` is set] → The implode error already names `force`. Docs state that `from` does not move the merge base.
- [`from` names a remote branch that was never fetched] → No fetch. The call fails with the unresolved name. The user fetches, then retries.
- [`HEAD` from a linked worktree surprises someone who meant the primary checkout] → The spec pins `HEAD` to the current worktree, and a test covers both that case and a non-checkout falling back to `variant.main`.

## Migration Plan

No stored data changes. Existing `create(slug)` calls keep their meaning. Rollback is reverting the change: omitted `from` is already `variant.baseBranch`.
