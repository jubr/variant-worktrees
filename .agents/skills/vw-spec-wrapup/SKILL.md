---
name: vw-spec-wrapup
description: >
  After a green feature PR: sync-archive the OpenSpec change on the same
  feature branch, commit and push, optionally merge on an explicit request,
  fast-forward main, remove the worktree. Use for /vw-spec-wrapup
  or /vw-spec-archive.
---

# vw-spec-wrapup

Close out `$slug` after implementation CI is green.
**Sync-archive** (sync delta specs into `openspec/specs/`, then move the change under `openspec/changes/archive/`) lives on the **same feature branch** (`$type/$slug` or current).

## Required reads (MUST)

- MUST read skill `openspec-archive-change` and follow it for artifact/task checks, delta sync prompts, and the archive move. Do not duplicate its prompts or sync rules.
- If sync is chosen, that skill already requires inline `openspec-sync-specs` behavior — follow it; do not invent a second merge procedure. Wrapup's default action is **sync-archive** (sync, then archive).
- MUST read `AGENTS.md` / `CONTRIBUTING.md` only as needed for commit/PR hygiene.

## Tools

- If not in `mise hook-env`: Always `mise x -- …` for `openspec`, `task`, `bun`, and other project tools.
  This applies to all command invocations in this file. Also note `mise` manages env vars for child processes.
- GitHub CLI should already be authenticated from `vw-spec-start`; if not, follow that skill's `gh` step.
- Remove the feature worktree with `git worktree remove` after `main` in the primary checkout contains the merge. Do not add a Taskfile task for that removal.

## Steps

1. **Validate before sync-archive.** From the feature worktree, run `openspec validate --all --strict --no-interactive`. If validation fails, fix violations (typically task checkboxes, artifact completeness, or spec format) before proceeding. Sync-archive only after strict validation passes.
2. **Tasks commit (if needed).** If `openspec/changes/$slug/tasks.md` (and other leftover change-dir checkbox or artifact edits) are dirty and not yet committed: commit them **now**, as their own Conventional Commit, **before** the sync-archive move. Do not mix with product code. Do not mix with the later sync-archive commit. Skip this step when there is nothing to commit.
3. **Stay on the feature branch.** Sync-archive in the current feature worktree on `$type/$slug` or current. Reuse the existing feature pull request. Do not open a second branch or a second pull request for the archive.
4. **Sync-archive change.** Follow skill `openspec-archive-change` for `$slug`. Prefer **sync now** (inline `openspec-sync-specs`), then the archive move. Target ends under `openspec/changes/archive/YYYY-MM-DD-$slug/` (date prefix rules from that skill).
5. **Sync-archive commit.** One Conventional Commit for the synced main specs **and** the archive move (`openspec/specs/` plus the move under `openspec/changes/archive/`). Include the archived `tasks.md` checkbox state via that move. Do not mix product code into this commit.
6. `[skip ci]` **on the sync-archive commit — only when both are true:**
   - A GitHub Actions run for this pull request or branch is **already running** or already **success**, and
   - This push is the **sync-archive commit only** (no product or code commits in the same push).
   Intent: do not re-trigger CI for a docs-only tip. **Do not** add `[skip ci]` if the same push also contains product code. That code must still run CI.
7. **Push** to the existing feature branch and pull request (`git push`). Update the pull request body with a sync-archive note (`gh pr edit`).
8. **Merge on explicit request only.** Run `gh pr merge` only when **all** of these are true:
   - the user **explicitly** asked to merge, and
   - the product-code Actions run is **success** (not a skipped sync-archive tip).
   Default is no merge. Never merge a failed or still-running run. The human reviewer owns the merge otherwise.
9. **Fast-forward the main checkout** — only after the pull request is merged. In the **primary** product checkout (not the feature worktree), inspect `git status` and `git log` first. Then `git fetch` and `git pull --ff-only` on `main`. Do not reset, checkout, or clean in a way that drops local commits or uncommitted work. If fast-forward would fail or unique local commits exist, stop and ask what to do. Do not rewrite that checkout. If the pull request is not merged yet, skip this step and skip worktree removal.
10. **Remove the worktree** — only after `main` in the primary checkout has the merge. `git worktree remove` the `_v-$slug` path after switching away from it. Refuse removal when the tree is dirty or that merge is not in the primary checkout. Report leftovers instead.
11. **Stop caffeinate.** Stop any leftover `caffeinate` from `vw-spec-pipeline`.

## Done when

- OpenSpec strict validation passed before sync-archive.
- A tasks checkbox commit exists when it was needed, separate from the sync-archive commit.
- The sync-archive commit is pushed to the existing pull request.
- The worktree is removed with `git worktree remove` only when that removal is safe.
