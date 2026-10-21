---
name: vw-spec-pipeline
description: >
  Push the feature branch, open or update a GitHub PR with gh, and loop on
  Actions until success. Use after local `task check:full` is green, /vw-spec-pipeline.
---

# vw-spec-pipeline

Ship `$slug` through GitHub Actions. Assume local `task check:full` already passed (`vw-spec-iterate`). Assume `gh auth status` succeeded in `vw-spec-start`.

## Required reads (MUST)

- MUST read `CONTRIBUTING.md` Verification if CI fails on a gate you did not run locally (skip if already in chat history).
- MUST read skill `vw-spec-iterate` when a pipeline failure needs a code/test fix, then return here.
- Do not restate OpenSpec propose/apply/archive flows; this skill is push + PR + CI only.
- Do not restate `gh` auth; if `gh` fails auth, follow the GitHub CLI step in skill `vw-spec-start`, then continue.

## Tools

- If not in `mise hook-env`: Always `mise x -- …` for `openspec`, `task`, `bun`, and other project tools.
  This applies to all command invocations in this file. Also note `mise` manages env vars for child processes.
- Git: commit only when the user asked or when fixing CI requires a new commit; never `--no-verify` unless explicitly requested. Stop and ask when non-trivial uncommitted work is present. Product-code pushes must not use `[skip ci]`.

## Caffeinate

Start `caffeinate -disu` in the background for the whole pipeline loop so the host does not sleep mid-wait.
One short note in chat (opt-out): running under `caffeinate -disu` — say **stop caffeinate** to kill it.
Stop caffeinate when the pipeline is SUCCESS (or the user aborts). If wrapup follows immediately, leave caffeinate running until wrapup finishes.

## Loop

1. Ensure branch `feat/$slug` (or current feature branch) is pushed: `git push -u origin HEAD` as needed.
2. Open PR if missing: `gh pr create --base main --title '…' --body '…'` with summary + test plan. If a PR already exists for the branch, reuse it (`gh pr view --json url`). Note the PR URL in chat asap.
3. Find the Actions run for the tip commit (`gh run list --branch <branch>`). Prefer `gh run watch <id>`.
4. On **failure**: pull job logs (`gh run view <id> --log-failed`), fix root cause (follow `vw-spec-iterate` / `tdd`), commit, push, wait again. Do not put `[skip ci]` on a product-code push.
5. While a run is in progress, if the pull request is not mergeable, merge `origin/main` into the branch, fix conflicts, commit, and push. Do not use `[skip ci]` on that push. Then wait on the new run.
6. Repeat until overall result is **success** (lint, build, test, and other default gates green).
7. Report the pull request URL and the green run number. Hand off to `vw-spec-wrapup` when the user wants sync-archive or cleanup.

## Notes

- Default workflows run on branch push and pull_request against `main`. Treat the CI workflow as the gate.
- Keep the pull request description updated if scope shifted during CI fixes.
- Sync-archive `[skip ci]` belongs to `vw-spec-wrapup`, not this skill.
