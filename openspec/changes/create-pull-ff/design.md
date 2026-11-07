## Context

See proposal.md for why. `ensureWorktree` creates a new branch with `git worktree add -b <prefix><slug> <dest> <start>` from the primary checkout. `start` is `variant.baseBranch`, or the commit `from` resolves to. The new branch has no upstream. `create` and `provision` call `ensureWorktree` directly. `up` and `watch` call it through `prepareVariant` → `createVariant`. The four commands are one `CommandDefinition` each. `runGit` drops stderr.

## Goals / Non-Goals

**Goals:**

- Fast-forward the start branch before `git worktree add -b`, only when `pullFf` is set and a new branch will be created.
- Leave no branch and no directory when that update fails.
- Build the retry line from the command name and the options the call already has.

**Non-Goals:**

- A pull inside the new worktree.
- A merge commit when the start branch has diverged.
- Fetching so that a tag, a raw commit, or a remote-tracking name becomes newer.
- Resetting a checkout that `--autostash` left conflicted.

## Decisions

### Update the start branch, never the new one

The new branch is born without an upstream, so `git pull` there fails with "no tracking information" and cannot refresh `main`. The commit the new branch should start at is the upstream tip of the start branch. Update that branch, then pass its tip to `git worktree add -b`.

`from` selects the start branch when it names a local branch (`refs/heads/…`). Otherwise the start branch is `variant.baseBranch`. A tag, a commit id, or a remote-tracking name is not a local branch: skip the update and keep today's resolve. `HEAD` is a commit, not a branch name, so it skips the update too.

Alternative: pull after `worktree add`. Rejected. There is nothing to pull.

### Fast-forward only

A checked-out start branch updates with `git -C <checkout> pull --ff-only --autostash`. `--ff` is the default and creates a merge commit when the histories diverge. `--ff-only` matches the failure the caller asked for: the command aborts, and the checkout is not merged. `--autostash` is what puts local modifications back.

A start branch checked out in no worktree updates with `git fetch <remote> <upstream-branch>:<local-branch>` from the primary checkout. A non-forced refspec refuses a non-fast-forward. No stash: no worktree files change. Read the remote and the upstream branch from `branch.<name>.remote` and `branch.<name>.merge`, not by splitting `@{upstream}`.

`git fetch` into the currently checked-out branch is refused by git, so the checked-out path stays `pull`.

Alternative: `git pull --ff --autostash` everywhere. Rejected. It merges on divergence, and it cannot run for a branch that is not checked out.

### Reuse and `main` skip the network

The existing-worktree return and the existing-prefixed-branch checkout stay where they are, ahead of the update. Slug `main` returns the primary checkout and does not pull. A second `create --pull-ff` of an existing slug does not move it.

### Fail before any directory

Run the update after those reuse checks and before `mkdir` and `git worktree add`. Resolve the start commit after a successful update so the new branch sees the new tip. Missing upstream, a rejected fast-forward, and a non-zero pull or fetch throw. Do not delete a stash and do not reset the checkout.

The error includes git's stderr, the checkout path when one was updated, one sentence on the repair (set an upstream, reconcile the divergence in that checkout, or fix the conflict `--autostash` left), and one line:

`variant <command> --pull-ff [--from <value>] --slug <slug>`

`watch` also prints `--detach` and `--reprovision` when those were set. Thread the command name and those flags into `ensureWorktree` from `create`, `provision`, `up`, and `watch`. Only `pullFf === true` updates. `false` and omitted do not.

Capture stderr on this git call. Leave the existing `runGit` stderr behavior for other calls.

### Same argument shape as `from`

`pullFf?: boolean` sits beside `from` on `create` and on the options of `provision`, `up`, and `watch`. The command definitions map the boolean. The CLI flag is `--pull-ff` with no short flag. MCP tools and forms follow the definition.

### Tests use a local remote

Fixture repos get a bare clone as `origin` and an upstream on the start branch. No network.

### Agent entry

`.agents/skills/vw-spec-start/SKILL.md` drops the "Sync base" step (`git fetch` and `git pull --ff-only`). The workspace step is `variant create -s $slug --pull-ff`, with `--from` only when the caller names a start. `AGENTS.md` names the flag on the create bullet. `vw-spec-wrapup` keeps its own post-merge fast-forward.

## Risks / Trade-offs

- [`--autostash` pop conflicts and leaves the start checkout dirty] → The variant call still fails with no new worktree. The error names that checkout. The implementation does not reset or clean it.
- [Two creates fast-forward the same checkout at once] → Git serializes the update. The loser fails the fast-forward and retries the printed command.
- [`pullFf` needs a reachable upstream] → Omitted, create stays offline. Set, a network or upstream failure aborts before a worktree exists.
- [A branch whose upstream remote is not `origin`] → The remote comes from `branch.<name>.remote`.

## Migration Plan

No stored data changes. Omitted `pullFf` keeps today's create. Rollback is reverting the change. The skill and `AGENTS.md` revert with it, which puts the manual pull back on the agent.

## Open Questions

None.
