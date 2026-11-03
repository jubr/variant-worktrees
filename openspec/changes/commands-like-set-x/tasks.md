## 1. Implode report

- [ ] 1.1 Rewrite the implode report tests in `packages/variant-api/test/implode.test.ts` for [specs/variant-api/implode | Implode report](../../specs/variant-api/implode/spec.md#requirement-implode-report) and see them fail. Cover: a one-line edit of `src/a.ts` yields a blank line, the yellow trace `\033[0;33m+ \033[0m git status`, `\033[0;33m+ \033[0m git diff --stat`, and `\033[0;33m+ \033[0m git diff -U1 src/a.ts`, then a patch whose first line contains `+++` and `src/a.ts` and whose changed line is colored, and the report has no `diff --git`; the progress log receives that same `report` string; `src/a.ts` then `src/b.ts` stay in that order; `maxDiffLines: 0` keeps status and stat and drops every `git diff -U1`; an untracked file and a staged-only change appear in status and have no `git diff -U1`; a path with a space is quoted in its trace. Run `mise x -- bun test packages/variant-api/test/implode.test.ts` and confirm the new assertions fail.
- [ ] 1.2 Implement the report in `worktreeReport` as [design.md](design.md) describes: `git -c color.ui=always` for `status`, `diff --stat`, and per-path `diff -U1 -- <path>` from `git diff --name-only`; blank line plus `\033[0;33m+ \033[0m` and the command (`git diff -U1 <path>`, `--` only in the argv); drop the first three patch lines; include every patch only when the kept lines are at most `maxDiffLines`. Do not change `echoCommand`. The tests of 1.1 pass, and the existing discard-after-report and worktree-removed-last cases still pass.
- [ ] 1.3 Commit the task group (tests and `worktreeReport` only).

## 2. Docs

- [ ] 2.1 Update `docs/guide/configuration.md` (`maxDiffLines` counts the kept `-U1` patch lines; the report shows traced colored `git status`, `git diff --stat`, and per-file `git diff -U1`) and the `maxDiffLines` comment in `packages/variant-config/variants.example.yaml`. Add a breaking `### Changed` bullet under `## Unreleased` in `CHANGELOG.md` for the report body. Verify those three files describe the new report and no longer say the report holds a raw full `git diff`.
- [ ] 2.2 Commit the docs group.

## 3. Validation

- [ ] 3.1 Run `mise x -- bun test packages/variant-api/test/implode.test.ts` and `mise x -- openspec validate --all --strict --no-interactive`. Both exit 0.
