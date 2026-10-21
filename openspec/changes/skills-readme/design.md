## Context

See [proposal.md](proposal.md) for why. The approach is a `diff -U2` port: take the reference close-out, keep this repo's host.

Today `vw-spec-wrapup` validates, branches `archive-$slug` from `main`, puts sync and archive in one `[skip ci]` commit, opens a second pull request, and removes a clean worktree with `git worktree remove`. The reference stays on the feature branch, commits a dirty `tasks.md` first, syncs then archives, and pushes to the existing pull request.

Constraints that the diff must not cross: GitHub and `gh`; worktree prefix `_v-`; root `package.json` with bun:test and Biome through hk; the iterate size check; `task bootstrap` already runs mise trust, mise install, and bun install. This Taskfile has no `variant:watch` or `variant:implode` tasks. `variant implode` is the consumer CLI.

Files with an empty diff, left untouched: `openspec-propose`, `openspec-archive-change`, `openspec-sync-specs`, `openspec-explore`, and both `tdd/references` files. `tdd/SKILL.md` and `git-scripted-rebase/SKILL.md` differ by one Nest health sentence. `openspec-apply-change` differs by its completion sentence. The `AGENTS.md` diff replaces this repo's overview and GitHub Actions section with the other product's layout and Bitbucket runners. The rules file differs only by a project-name description that is already correct here.

## Goals / Non-Goals

**Goals:**

- One close-out, described the same way in the four `vw-spec-*` skills, the apply-change completion line, and `CONTRIBUTING.md`.
- A README first-run that calls commands this repo has, and a chat-renamer mention that links out instead of copying the package README.

**Non-Goals:**

- Renaming `vw-spec-*` skills, or matching the reference's blank-line layout.
- See proposal non-goals for the rejected port (Bitbucket, watch loop, demo skill, test-stack swap, `AGENTS.md` rewrite, `task variant:implode`).

## Decisions

### Same-branch sync-archive, translated to GitHub

Adopt the reference close-out shape.

- `bkt` stays `gh`. `_work-$slug` stays `_v-$slug`.
- No demo recording steps and no stop-watch step. `vw-spec-start` does not start `variant:watch`.
- Worktree removal stays `git worktree remove` once the primary checkout's `main` contains the merge. Do not add a Taskfile task that calls product `variant implode`.
- `[skip ci]` only when both are true: a run for this branch is already in progress or green, and the push contains only the sync-archive commit. A push that also contains product code runs CI.
- `gh pr merge` only when the user explicitly asked and the product-code run succeeded. Otherwise the human reviewer merges.
- Fast-forward the primary checkout only after the pull request is merged. Inspect status first. If fast-forward would drop local commits or uncommitted work, stop and ask. Do not reset that checkout.

Alternative considered: keep the `archive-$slug` pull request so `[skip ci]` rides a separate merge. Rejected. The reference replaced that flow, and the `[skip ci]` guard above serves the same purpose on the feature branch.

### Per-file edits

- `vw-spec-start`: keep chat rename, fetch and fast-forward `main`, `_v-$slug`, `task install`, `gh auth status`, propose, and the single OpenSpec commit. Change the hand-off sentence so close-out is same-branch sync-archive in `vw-spec-wrapup`. Do not add watch, `bkt`, or a `demo.md` skeleton.
- `vw-spec-iterate`: keep the size check and `task test`, `task lint`, `task build`, `task check:changed`, `task check:full`, `task format:write`. State that iterate does not sync-archive, and that `tasks.md` checkbox edits stay dirty until wrapup. Do not add `variant:watch` or `app:` / `server:` task names. Leave the conflict-resolution line on "application code"; `AGENTS.md` does not mention migrations.
- `vw-spec-pipeline`: keep `gh pr create`, `gh run watch`, and `gh run view --log-failed`. Add: ask before committing non-trivial uncommitted work; product-code pushes do not use `[skip ci]`; when the pull request is not mergeable, merge `origin/main`, fix, and push; leave `caffeinate` running when wrapup follows immediately; point the sync-archive `[skip ci]` rule at wrapup. Do not copy the Bitbucket mergeability API, a paused deploy step, or a narrated demo.
- `vw-spec-wrapup`: replace the body with the translated sequence. Default action is sync now, then the archive move, on `$type/$slug`. Tasks commit first when change-dir checkbox edits are dirty. Push to the existing pull request and note the sync-archive in the body.
- `openspec-apply-change`: one sentence. On completion, point at `vw-spec-wrapup` for sync-archive (sync deltas, then archive). Do not name the reference skill.
- `tdd`, `git-scripted-rebase`, the rules file, identical OpenSpec skills, and `AGENTS.md`: no edit.
- `CONTRIBUTING.md`: in the citing section, call the close-out day sync-archive. In Review and delivery, replace the single end commit with the split (spec commit, code commits, tasks commit when dirty, then a separate sync-archive commit) on the same feature branch, and the explicit-request merge rule. Leave Outside-in TDD, Tool execution, Verification, Continuous integration, and Releasing as they are.

### README

Put **Getting started** after the opening paragraph.

- Contributor checkout: `mise x -- task bootstrap`, then `mise x -- task build`.
- Using the tool: `example/` is the Vite + NestJS + SQLite project. Point at `example/README.md` for seed, ports, and containers. Name `variant config`, `variant create`, and `variant watch --detach`, and point at the existing Configuration section plus `docs/guide/scripts.md` for every option.
- Development commands stay in the existing Development section. Do not copy them into Getting started.

Add `chat-renamer-api`, `chat-renamer-config`, and `chat-renamer-vscode` to the package list. Add a short chat-renamer paragraph: `/chat-rename` and the activation patterns rename from the first prompt (`/vw-spec-start my-slug` becomes `my-slug`); `variant-vscode` embeds the extension and owns renaming when both are installed; options are the `chatRenamer` section (already in Configuration) and `packages/chat-renamer-vscode/README.md`. Do not copy that README's internals.

### Taskfile and scripts

After the prose edit, list every `task` name the skills and `CONTRIBUTING.md` cite and match it to `Taskfile.yaml`. Expected hits (`bootstrap`, `install`, `build`, `lint`, `test`, `format:write`, `check:changed`, `check:full`, `commitlint`) already exist. Add or adjust a task only when that list has a gap. Do not add `variant:watch` or `variant:implode`.

## Risks / Trade-offs

- [An in-flight change still expects `archive-$slug`] → Once this lands, wrapup follows the new skill. No data migration.
- [Same-branch sync-archive retriggers CI] → `[skip ci]` is limited to a sync-archive-only push when a run is already green or in progress.
- [`[skip ci]` hides a bad archive] → Strict `openspec validate` is required before that commit, and the product-code run has already passed.
- [Getting started drifts from `example/README.md`] → It links there for seed, ports, and containers.
- [A dirty primary checkout blocks fast-forward] → Wrapup stops and asks. It does not reset that checkout.
- [No delta spec for the README] → `skip_specs: true`. Review is the check. Validation still runs.

## Migration Plan

1. Edit the skills and `CONTRIBUTING.md` in one pass so they agree.
2. Edit `README.md`.
3. Inventory cited `task` names. Patch `Taskfile.yaml` or a script only for a real gap.
4. Run `openspec validate --all --strict --no-interactive`. Documentation-only: no new product tests. Iterate still runs `task check:full`.
5. Rollback is reverting those files. Nothing is published under `openspec/specs/`.

## Open Questions

None. Host translation (`gh`, `_v-`, no watch, no demo, no Taskfile implode) is settled.
