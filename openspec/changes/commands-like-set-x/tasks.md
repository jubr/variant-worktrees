## 1. Implode report

- [ ] 1.1 Rewrite the implode report tests in `packages/variant-api/test/implode.test.ts` for [specs/variant-api/implode | Implode report](../../specs/variant-api/implode/spec.md#requirement-implode-report) and see them fail. Cover: a one-line edit of `src/a.ts` yields `\n\033[33m+ git status --porcelain\033[0m\n` and a body containing ` M src/a.ts`, the same wrapper around `git diff --stat`, and around `git diff -U1 src/a.ts`, then a patch whose first line contains `+++` and `src/a.ts`; the patch has no ANSI, no `diff --git` line, no `index <hex>..<hex>` line, and no line starting with `--- `; the progress log receives that same `report` string; `src/a.ts` then `src/b.ts` stay in that order and both files lose those header shapes while both `+++` lines remain; `maxDiffLines: 0` keeps porcelain status and stat and drops every `git diff -U1`; an untracked file shows `??` and a staged-only change shows `M `, and neither has `git diff -U1`; a path with a space is quoted in its trace. Run `mise x -- bun test packages/variant-api/test/implode.test.ts` and confirm the new assertions fail.
- [ ] 1.2 Implement the report in `worktreeReport` as [design.md](design.md) describes: `git -c color.ui=never` for `status --porcelain`, `diff --stat`, and per-path `diff -U1 -- <path>` from `git diff --name-only`; prefix `\n\033[33m+ <command>\033[0m\n` with the command text `git status --porcelain`, `git diff --stat`, or `git diff -U1 <path>` (`-c` and `--` stay out of the trace); drop patch lines by the three header shapes, not by a leading line count; include every patch only when the kept lines are at most `maxDiffLines`. Do not change `echoCommand`. The tests of 1.1 pass, and the existing discard-after-report and worktree-removed-last cases still pass.
- [ ] 1.3 Commit the task group (tests and `worktreeReport` only).

## 2. Docs

- [ ] 2.1 Update `docs/guide/configuration.md` (`maxDiffLines` counts the kept `-U1` patch lines; the report shows a dark-yellow trace around plain `git status --porcelain`, `git diff --stat`, and per-file `git diff -U1`) and the `maxDiffLines` comment in `packages/variant-config/variants.example.yaml`. Add a breaking `### Changed` bullet under `## Unreleased` in `CHANGELOG.md` for the report body. Verify those three files describe the new report and no longer say the report holds a raw human `git status` or a raw full `git diff`.
- [ ] 2.2 Commit the docs group.

## 3. Validation

- [ ] 3.1 Run `mise x -- bun test packages/variant-api/test/implode.test.ts` and `mise x -- openspec validate --all --strict --no-interactive`. Both exit 0.
