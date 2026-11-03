## MODIFIED Requirements

### Requirement: Implode report

The system SHALL return and print, before removing the worktree and before discarding lockfile changes, a report of what the worktree still holds. The same report string SHALL be the value returned on the result and the text printed for it.

The report SHALL list the git commands that show that dirt, in this order, skipping a command whose output is empty: `git status`, `git diff --stat`, then one `git diff -U1 <path>` for each path that `git diff --name-only` lists, in that order. `<path>` SHALL be the path that listing prints, relative to the worktree. Each kept command SHALL be preceded by a blank line and a trace line that is `\033[0;33m+ \033[0m` immediately followed by the command text (`+ git status`, `+ git diff --stat`, or `+ git diff -U1 <path>`). The command output SHALL follow the trace line and SHALL be colored as `git -c color.ui=always` prints it, including when the output is captured and standard output is not a terminal.

The output of each `git diff -U1 <path>` SHALL drop its first three lines and keep the rest. For a modification of a tracked file those three lines are the `diff --git` line, the `index` line and the `---` line, so the patch starts at the `+++` line and the hunk, with one line of context. A longer header SHALL keep every line after the third.

The per-file patches SHALL be included only when the number of kept patch lines, not counting trace lines, is at most `variant.implode.maxDiffLines`. When it is greater, the report SHALL still contain the status and the stat and SHALL contain no `git diff -U1` command. An untracked path, and a change that `git diff` without `--cached` does not list, SHALL appear only in `git status`.

#### Scenario: Short diff shown

- **WHEN** tracked `src/a.ts` has an unstaged one-line modification and `maxDiffLines` is 200
- **THEN** the report contains a blank line and the trace `\033[0;33m+ \033[0m git status` followed by a status body that names `src/a.ts`, the trace `\033[0;33m+ \033[0m git diff --stat` followed by a stat body, and the trace `\033[0;33m+ \033[0m git diff -U1 src/a.ts` followed by a patch whose first line contains `+++` and `src/a.ts` and a hunk, and the report does not contain `diff --git`

#### Scenario: Color when captured

- **WHEN** that report is produced while standard output is not a terminal
- **THEN** the patch contains an ANSI color sequence for the changed line and the `+` of each trace line is the yellow sequence `\033[0;33m`

#### Scenario: Two files in listed order

- **WHEN** tracked `src/a.ts` and `src/b.ts` both have unstaged modifications and the patches fit in `maxDiffLines`
- **THEN** the report contains `+ git diff -U1 src/a.ts` before `+ git diff -U1 src/b.ts`

#### Scenario: Long diff summarized

- **WHEN** `maxDiffLines` is 0 and a tracked file has an unstaged modification
- **THEN** the report contains `+ git status` and `+ git diff --stat` and does not contain `git diff -U1`

#### Scenario: Untracked file

- **WHEN** the worktree has an untracked file and no modification of a tracked file
- **THEN** the status body names that file and the report does not contain `git diff -U1`

#### Scenario: Staged change only

- **WHEN** a tracked file is staged and the worktree has no unstaged modification
- **THEN** the status body names that file and the report does not contain `git diff -U1`

#### Scenario: Worktree removed last

- **WHEN** the implode succeeds
- **THEN** the result names the removed worktree path and the directory no longer exists
