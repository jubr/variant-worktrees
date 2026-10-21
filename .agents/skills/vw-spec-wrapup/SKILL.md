---
name: vw-spec-wrapup
description: >
  After a green feature PR: archive OpenSpec change on archive-$slug,
  commit/push/PR the archive, remove clean worktree. Use for /vw-spec-wrapup
  or /vw-spec-archive.
---

# vw-spec-wrapup

Close out `$slug` after implementation CI is green.
Spec sync + archive live on branch `archive-$slug`, not on the feature tip, unless the user says otherwise.

## Required reads (MUST)

- MUST read skill `openspec-archive-change` and follow it for artifact/task checks, delta sync prompts, and the archive move. Do not duplicate its prompts or sync rules.
- If sync is chosen, that skill already requires inline `openspec-sync-specs` behavior — follow it; do not invent a second merge procedure.
- MUST read `AGENTS.md` / `CONTRIBUTING.md` only as needed for commit/PR hygiene.

## Tools

- If not in `mise hook-env`: Always `mise x -- …` for `openspec`, `task`, `bun`, and other project tools.
  This applies to all command invocations in this file. Also note `mise` manages env vars for child processes.
- GitHub CLI should already be authenticated from `vw-spec-start`; if not, follow that skill's `gh` step.

## Steps

1. **Validate before archive.** From the feature worktree, run `openspec validate --all --strict --no-interactive`. If validation fails, fix violations (typically task checkboxes, artifact completeness, or spec format) before proceeding. Archive only after strict validation passes.
2. **Archive branch.** From updated `main` (ff-only), create/checkout `archive-$slug` (worktree or branch on the feature worktree — keep the working tree dedicated to archive commits).
3. **Archive change.** Follow skill `openspec-archive-change` for `$slug` (sync deltas when recommended). Target ends under `openspec/changes/archive/YYYY-MM-DD-$slug/` (date prefix rules from that skill).
4. **Commit + push.** One Conventional Commit for the archive **and** the synced main specs (`openspec/specs/` plus the move under `openspec/changes/archive/`). Include the working-tree `tasks.md` checkbox state in that archive copy. Do not mix product code into this commit. Append `[skip ci]` to commit msg.
Finally `git push`.
5. **PR.** `gh pr create --base main` for `archive-$slug` (title/body: archived change + sync note). Append `[skip ci]` to PR title, so the merge commit message will also include it.
6. **Remove worktree if clean.**
   - Check if `_v-$slug` (or current feature worktree) has no meaningful uncommitted work and the feature PR is merged or no longer needed locally.
   - Judge if remaining uncommitted files do not represent meaningful work. If they do not: `rm -f` or `git checkout`
   - Then `git worktree remove` that path after switching away. Refuse removal when the tree is dirty; report leftovers instead.
7. Stop any leftover `caffeinate` from `vw-spec-pipeline`.

## Done when

- OpenSpec strict validation passed before archive.
- OpenSpec change archived (and synced if that was selected).
- `archive-$slug` pushed with a PR URL.
- Worktree removed only when clean.
