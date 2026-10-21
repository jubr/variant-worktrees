## 1. Close-out skills

- [ ] 1.1 Rewrite `.agents/skills/vw-spec-wrapup/SKILL.md` per design.md (same feature branch, tasks commit then sync-archive commit, `gh`, `_v-`, `git worktree remove`, `[skip ci]` only for a sync-archive-only push when CI is already green or running, merge only on an explicit request plus a green product-code run, fast-forward the primary checkout only after merge and ask if that checkout is dirty). Verify the file has no `archive-$slug` branch step, no `bkt`, no `_work-`, no demo recording, and no `variant:watch` stop.
- [ ] 1.2 Update the hand-off in `.agents/skills/vw-spec-start/SKILL.md` so close-out is same-branch sync-archive in `vw-spec-wrapup`. Verify chat rename, `git fetch` plus fast-forward of `main`, `_v-$slug`, `task install`, and `gh auth status` are still there, and the file does not mention `bkt`, `variant:watch`, or `demo.md`.
- [ ] 1.3 Update `.agents/skills/vw-spec-iterate/SKILL.md` so it does not sync-archive and leaves `tasks.md` checkbox edits dirty until wrapup. Verify the size check and `task test`, `task lint`, `task build`, `task check:changed`, `task check:full`, and `task format:write` remain, and the file has no `app:` or `server:` task names and no `variant:watch` line.
- [ ] 1.4 Update `.agents/skills/vw-spec-pipeline/SKILL.md` per design.md (ask on non-trivial uncommitted work, no `[skip ci]` on product pushes, merge `origin/main` when the pull request is not mergeable, leave `caffeinate` running when wrapup follows, point sync-archive `[skip ci]` at wrapup). Verify `gh pr create`, `gh run watch`, and `gh run view --log-failed` remain, and the file has no `bkt`.
- [ ] 1.5 Change the completion sentence in `.agents/skills/openspec-apply-change/SKILL.md` to point at `vw-spec-wrapup` for sync-archive. Verify that sentence names `vw-spec-wrapup` and does not name `bg-spec-wrapup`.

## 2. Contributing

- [ ] 2.1 Update the citing section and Review and delivery in `CONTRIBUTING.md` per design.md (sync-archive wording, tasks commit then a separate sync-archive commit, same feature branch, merge only when explicitly requested and CI succeeded). Verify a diff of `CONTRIBUTING.md` does not change Outside-in TDD, Tool execution, Verification, Continuous integration, or Releasing.

## 3. README

- [ ] 3.1 Add a Getting started section to `README.md` after the opening paragraph: `mise x -- task bootstrap`, `mise x -- task build`, then `example/` with a link to `example/README.md`, and `variant config`, `variant create`, and `variant watch --detach`, pointing at Configuration and `docs/guide/scripts.md` for the full option list. Verify those commands and links are in that section and the Development section is unchanged.
- [ ] 3.2 List `chat-renamer-api`, `chat-renamer-config`, and `chat-renamer-vscode` in the package list, and add a short chat-renamer paragraph (`/chat-rename`, `/vw-spec-start my-slug`, embedded in `variant-vscode`, link to `packages/chat-renamer-vscode/README.md`). Verify the existing Configuration sentence about `chatRenamer` is still present and the package README's internals are not copied.

## 4. Tasks and scripts

- [ ] 4.1 List every `task <name>` cited by the updated skills and `CONTRIBUTING.md` and match it to `Taskfile.yaml`. Add or adjust a task or script only when a cited name is missing. Verify each cited name is a task key, and that `variant:watch` and `variant:implode` were not added.

## 5. Validation

- [ ] 5.1 Run `openspec validate --all --strict --no-interactive`. Verify it exits 0. Verify `git diff` against `main` does not touch `AGENTS.md`, `.agents/rules/variant-worktrees.mdc`, `.agents/skills/tdd/`, `.agents/skills/git-scripted-rebase/`, or the unchanged OpenSpec skills (`openspec-propose`, `openspec-archive-change`, `openspec-sync-specs`, `openspec-explore`).
