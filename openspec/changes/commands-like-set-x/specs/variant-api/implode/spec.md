## MODIFIED Requirements

### Requirement: Implode report

The system SHALL return and print, before removing the worktree and before discarding lockfile changes, a report of what the worktree still holds. The same report string SHALL be the value returned on the result and the text printed for it.

The report SHALL list the git commands that show that dirt, in this order, skipping a command whose output is empty: `git status --porcelain`, `git diff --stat`, then one `git diff -U1 <path>` for each path that `git diff --name-only` lists, in that order. `<path>` SHALL be the path that listing prints, relative to the worktree. Each kept command SHALL be the string `\n\033[33m+ <command>\033[0m\n` (dark yellow `\033[33m` around `+ <command>`, then `\033[0m`) followed by that command's output. The output SHALL be plain git text: git color SHALL be off, and the output SHALL contain no ANSI sequence. The trace SHALL be the only colored part of the report.

The output of each `git diff -U1 <path>` SHALL omit every line that is a `diff --git` header, an `index <hex>..<hex> <mode>` header, or an old-file header starting with `--- `, and SHALL keep every other line. Those lines SHALL be omitted wherever they occur, not by dropping a fixed number of leading lines. For a modification of a tracked file the kept patch starts at the `+++` line and the hunk, with one line of context. A header of another shape (`+++`, `new file mode`, `rename from`, `rename to`, `similarity index`) SHALL stay.

The per-file patches SHALL be included only when the number of kept patch lines, not counting trace lines, is at most `variant.implode.maxDiffLines`. When it is greater, the report SHALL still contain the porcelain status and the stat and SHALL contain no `git diff -U1` command. An untracked path, and a change that `git diff` without `--cached` does not list, SHALL appear only in `git status --porcelain`.

#### Scenario: Short diff shown

- **WHEN** tracked `src/a.ts` has an unstaged one-line modification and `maxDiffLines` is 200
- **THEN** the report contains `\n\033[33m+ git status --porcelain\033[0m\n` followed by a porcelain body that contains ` M src/a.ts`, `\n\033[33m+ git diff --stat\033[0m\n` followed by a stat body, and `\n\033[33m+ git diff -U1 src/a.ts\033[0m\n` followed by a patch whose first line contains `+++` and `src/a.ts` and a hunk, and the report does not contain `diff --git`, a line matching `index <hex>..<hex>`, or a line starting with `--- `

#### Scenario: Color when captured

- **WHEN** that report is produced while standard output is not a terminal
- **THEN** the `+` and the command of each trace are wrapped in `\033[33m` and `\033[0m`, and no command output contains an ANSI sequence

#### Scenario: Two files in listed order

- **WHEN** tracked `src/a.ts` and `src/b.ts` both have unstaged modifications and the patches fit in `maxDiffLines`
- **THEN** the report contains `+ git diff -U1 src/a.ts` before `+ git diff -U1 src/b.ts`, and both files' `diff --git`, `index <hex>..<hex>`, and `--- ` lines are absent while both `+++` lines are present

#### Scenario: Long diff summarized

- **WHEN** `maxDiffLines` is 0 and a tracked file has an unstaged modification
- **THEN** the report contains `+ git status --porcelain` and `+ git diff --stat` and does not contain `git diff -U1`

#### Scenario: Untracked file

- **WHEN** the worktree has an untracked file and no modification of a tracked file
- **THEN** the porcelain body contains `??` and that file's name, and the report does not contain `git diff -U1`

#### Scenario: Staged change only

- **WHEN** a tracked file is staged and the worktree has no unstaged modification
- **THEN** the porcelain body contains `M ` and that file's name, and the report does not contain `git diff -U1`

#### Scenario: Worktree removed last

- **WHEN** the implode succeeds
- **THEN** the result names the removed worktree path and the directory no longer exists
