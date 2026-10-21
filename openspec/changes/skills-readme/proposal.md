## Why

The repository README has no first-run path and does not name chat-renamer, and the agent spec skills still close a change on a second `archive-$slug` pull request. A `diff -U2` against the reference `.agents`, `AGENTS.md`, and `CONTRIBUTING.md` shows a newer close-out that belongs here, plus a large set of another product's CI, test runner, and app watch loop that does not.

## What Changes

- **BREAKING** for the contributor close-out: `vw-spec-wrapup` sync-archives on the same feature branch and reuses that pull request. It no longer opens `archive-$slug`. A dirty `tasks.md` is its own commit, then the sync-archive commit. `[skip ci]` is only on a sync-archive-only push when that branch's checks are already green or still running. Merge only when the user explicitly asks and those checks succeeded.
- Align `vw-spec-iterate`, `vw-spec-pipeline`, and the apply-change completion line with that close-out: iterate does not sync-archive; the pipeline asks before committing non-trivial uncommitted work, updates the branch from `main` when the pull request is not mergeable, and leaves `caffeinate` running when wrapup follows immediately. Keep the iterate size check, GitHub `gh`, the `_v-` worktree prefix, and this repo's `task` names.
- Update `CONTRIBUTING.md` citation wording and the review section so they describe the same close-out. Leave the bun:test, Biome, hk, and GitHub Actions sections in place.
- Add a short Getting started section to `README.md`: `task bootstrap`, build, then `variant config` / `create` / `watch`, with `example/` as the worked project. Name chat-renamer (standalone extension, embedded in `variant-vscode`, `/vw-spec-start <slug>` and `/chat-rename`) and link to its package README. List those packages beside the others.
- Confirm every `task` name the updated skills and `CONTRIBUTING.md` cite already exists. Add or adjust a Taskfile task or script only when a kept step has no command.

## Capabilities

### New Capabilities

None. This change is contributor documentation and agent skills. `.openspec.yaml` sets `skip_specs: true`.

### Modified Capabilities

None. Chat-renamer, the CLI, and the published docs site keep their current requirements.

## Impact

- `.agents/skills/vw-spec-start/SKILL.md`
- `.agents/skills/vw-spec-iterate/SKILL.md`
- `.agents/skills/vw-spec-pipeline/SKILL.md`
- `.agents/skills/vw-spec-wrapup/SKILL.md`
- `.agents/skills/openspec-apply-change/SKILL.md` (completion handoff sentence)
- `CONTRIBUTING.md` (citation wording and Review and delivery)
- `README.md` (Getting started, package list, chat-renamer)
- `Taskfile.yaml` and `scripts/` only if a cited command is missing

## Non-goals

- Copy Bitbucket or `bkt`, `_work-` worktrees, a Nest health check, or `variant:watch` as a step of `vw-spec-start`.
- Add `openspec-demo`, herd/coordinate skills, or a vibe-coding skill.
- Replace Biome, bun:test, Zod response types, or GitHub Actions with the reference test stack or pipeline.
- Rewrite `AGENTS.md`. Its project overview, file structure, and GitHub Actions section stay; the reference diff replaces them with another product's layout.
- Change chat-renamer runtime behavior or its specs.
- Rewrite VitePress `docs/`.
- Add `task variant:implode`. `variant implode` tears down a consumer variant. Feature worktrees of this repo are removed with `git worktree remove`.
