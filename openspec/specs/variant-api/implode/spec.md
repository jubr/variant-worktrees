# variant-api/implode Specification

## Purpose
Imploding retires a finished variant in one command: it tears the variant down, cleans configurable build leftovers,
shows what would be lost, and removes the git worktree, while a merge gate protects unmerged work.

## Requirements

### Requirement: Implode refuses main and unmerged work

The system SHALL provide `implode` for a slug. It SHALL refuse slug `main` and the primary checkout with an error. Unless `force` is given or `variant.implode.requireMerged` is `false`, it SHALL refuse when the `HEAD` of the variant's worktree is not an ancestor of `origin/<baseBranch>` (or of `<baseBranch>` when no such remote branch exists). A refusal SHALL change nothing: no runtime stops, no data is dropped, and the worktree stays. The error SHALL name the `force` option.

#### Scenario: Main refused

- **WHEN** `implode` runs for slug `main`
- **THEN** it fails with an error that names the primary checkout and nothing changes

#### Scenario: Unmerged refused

- **WHEN** the variant's `HEAD` has a commit that is not in `main` and `force` is not given
- **THEN** it fails naming `force`, and the worktree, database target and runtime are untouched

#### Scenario: Merged accepted

- **WHEN** the variant's `HEAD` is an ancestor of `main`
- **THEN** the implode proceeds

#### Scenario: Remote base branch

- **WHEN** `origin/main` exists and holds the variant's `HEAD` while the local `main` does not
- **THEN** the implode proceeds

#### Scenario: Gate disabled

- **WHEN** `variant.implode.requireMerged` is `false` and the variant is unmerged
- **THEN** the implode proceeds

#### Scenario: Forced

- **WHEN** the variant is unmerged and `force` is given
- **THEN** the implode proceeds and the worktree is removed with git's force option

### Requirement: Implode teardown

The system SHALL, after the merge gate passes, perform the teardown that the core capability specifies for implode (stop the runtime, drop the database target, delete storage, clear state) before it continues with the worktree. When the slug has no worktree it SHALL finish that teardown, report that no worktree existed, and then run the branch step.

#### Scenario: Teardown first

- **WHEN** a merged variant `demo` runs a watch and `implode` runs
- **THEN** the watch is stopped, its database target is dropped, and then the worktree is removed

#### Scenario: No worktree

- **WHEN** variant `demo` has a database target but no worktree
- **THEN** the target is dropped and the result reports that no worktree existed

#### Scenario: Branch kept

- **WHEN** implode of merged `demo` completes with `branchRm` `no`
- **THEN** the branch `feat/demo` still exists

### Requirement: Implode cleanup

The system SHALL, before the worktree report is taken and the worktree is removed, delete every path that matches a pattern of `variant.implode.preRm`, with `${slug}` replaced. A pattern SHALL be matched relative to the project directory and relative to each watch directory, so `dist` removes `fe/dist` and `be/dist` of watches in `fe` and `be`, and a dotfile or a directory such as `node_modules` is matched like any other name. A match that is, or contains, a file tracked by git SHALL be left in place. The system SHALL discard local modifications of tracked files whose base name is in `variant.implode.discard`, leaving other modified files as they are.

#### Scenario: Pre-removal directories

- **WHEN** `preRm` is `[dist, node_modules]`, a watch `fe` has `fe/dist` and `fe/node_modules`, and `implode` runs
- **THEN** both directories are gone before the worktree is removed

#### Scenario: Root directories

- **WHEN** `preRm` is `[node_modules]` and the project directory holds an untracked `node_modules`
- **THEN** it is deleted too

#### Scenario: Untracked recording removed

- **WHEN** `preRm` is `["openspec/changes/${slug}/pr*-demo.webm"]` and an untracked `openspec/changes/demo/pr7-demo.webm` exists
- **THEN** the file is deleted

#### Scenario: Tracked file with matching name kept

- **WHEN** a tracked file matches a `preRm` pattern, or a matching directory contains one
- **THEN** it is not deleted

#### Scenario: Removal precedes the report

- **WHEN** an untracked file matches a `preRm` pattern
- **THEN** the implode report does not list it

#### Scenario: Lockfile restored

- **WHEN** `discard` is `[bun.lock]` and the tracked `bun.lock` in the worktree is modified
- **THEN** its modification is discarded before the worktree is removed

#### Scenario: Other modifications left

- **WHEN** a tracked `src/a.ts` is modified and not listed
- **THEN** it is unchanged, and without `force` the worktree removal fails because of the dirty file

### Requirement: Implode report

The system SHALL return and print, before removing the worktree and before discarding lockfile changes, a report of what the worktree still holds. The same report string SHALL be the value returned on the result and the text printed for it. The text summary printed after the command returns SHALL NOT repeat that report.

The report SHALL list the git commands that show that dirt, in this order, skipping a command whose output is empty: `git status --porcelain`, `git diff --stat`, then one `git diff -U1 <path>` for each path that `git diff --name-only` lists, in that order. `<path>` SHALL be the path that listing prints, relative to the worktree. Each kept command SHALL be the string `\n\033[33m+ <command>\033[0m\n` (dark yellow `\033[33m` around `+ <command>`, then `\033[0m`) followed by that command's output. Git's own color SHALL be off. The tool SHALL color the diff body itself: each kept hunk line that starts with `+` and is not `+++` SHALL be wrapped in `\033[32m` and `\033[0m`, and each kept hunk line that starts with `-` SHALL be wrapped in `\033[31m` and `\033[0m`. Context lines, `+++` lines, and the output of `git status --porcelain` and `git diff --stat` SHALL contain no ANSI sequence. The report string SHALL contain these sequences when standard output is not a terminal.

The output of each `git diff -U1 <path>` SHALL omit every line that is a `diff --git` header, an `index <hex>..<hex> <mode>` header, or an old-file header starting with `--- `, and SHALL keep every other line. Those lines SHALL be omitted wherever they occur, not by dropping a fixed number of leading lines. For a modification of a tracked file the kept patch starts at the `+++` line and the hunk, with one line of context. A header of another shape (`+++`, `new file mode`, `rename from`, `rename to`, `similarity index`) SHALL stay.

The per-file patches SHALL be included only when the number of kept patch lines, not counting trace lines, is at most `variant.implode.maxDiffLines`. When it is greater, the report SHALL still contain the porcelain status and the stat and SHALL contain no `git diff -U1` command. An untracked path, and a change that `git diff` without `--cached` does not list, SHALL appear only in `git status --porcelain`.

#### Scenario: Short diff shown

- **WHEN** tracked `src/a.ts` has an unstaged one-line modification and `maxDiffLines` is 200
- **THEN** the report contains `\n\033[33m+ git status --porcelain\033[0m\n` followed by a porcelain body that contains ` M src/a.ts`, `\n\033[33m+ git diff --stat\033[0m\n` followed by a stat body, and `\n\033[33m+ git diff -U1 src/a.ts\033[0m\n` followed by a patch whose first line contains `+++` and `src/a.ts` and a hunk, and the report does not contain `diff --git`, a line matching `index <hex>..<hex>`, or a line starting with `--- `

#### Scenario: Color when captured

- **WHEN** that report is produced while standard output is not a terminal
- **THEN** the `+` and the command of each trace are wrapped in `\033[33m` and `\033[0m`

#### Scenario: Diff lines are colored

- **WHEN** tracked `src/a.ts` has an unstaged change that adds one line and removes one line, and `maxDiffLines` is 200
- **THEN** the added hunk line is wrapped in `\033[32m` and `\033[0m`, the removed hunk line is wrapped in `\033[31m` and `\033[0m`, and the `+++` line contains no ANSI sequence

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

### Requirement: Implode removes the local branch last

The system SHALL, as the last step of an implode that passed the merge gate, remove the variant's local git branch when `branchRm` is `yes` or omitted, and SHALL keep that branch when `branchRm` is `no`. It SHALL NOT remove a remote branch. A refusal of implode SHALL leave the branch in place.

The branch SHALL be the one checked out in the variant worktree, read before that worktree is removed. A detached HEAD has no branch to remove. When the slug has no worktree, the branch SHALL be the first existing local branch named by `variant.branchPrefixes` plus the slug, in that list's order. When no such branch exists, the step SHALL remove nothing and the implode SHALL still succeed.

The worktree removal SHALL complete before the branch is deleted. When the branch cannot be deleted, the implode SHALL fail, the error SHALL name the branch, and the branch SHALL still exist. The text summary SHALL contain `removed branch <name>` when the branch was removed, and SHALL NOT contain that line when the branch was kept or none existed. The result SHALL name the branch and whether it was removed.

A successful implode SHALL also emit one debug log event, and only that one finish event, whose message is `implode finished slug="<slug>"`. A refusal SHALL NOT emit it.

The branch step SHALL emit one debug log event. When the branch is removed, the message SHALL contain the branch name and `removed`. When `branchRm` is `no` and the branch exists, the message SHALL contain the branch name and `kept`. When no branch exists, the message SHALL contain the slug and say that no branch was removed. With the default log threshold the CLI SHALL NOT write that event. With `--log-level=debug` the CLI SHALL write it to standard error as a line that starts with `[debug]`.

A `branchRm` value other than `yes`, `no`, or omitted SHALL fail before any teardown, and the error SHALL name `yes` and `no`.

#### Scenario: Finish is one debug line

- **WHEN** implode of slug `demo` succeeds
- **THEN** the log has exactly one debug event whose message is `implode finished slug="demo"`
- **AND** a refused implode emits no such event

#### Scenario: Default removes the branch

- **WHEN** a merged variant `demo` on branch `feat/demo` is imploded with no `branchRm`
- **THEN** the worktree directory is gone, the local branch `feat/demo` is gone, the text summary contains `removed branch feat/demo`, and the result names `feat/demo` as removed

#### Scenario: Explicit yes

- **WHEN** that implode is run with `branchRm` `yes`
- **THEN** the local branch `feat/demo` is gone

#### Scenario: No keeps the branch

- **WHEN** that implode is run with `branchRm` `no`
- **THEN** the worktree is gone, the local branch `feat/demo` still exists, and the text summary does not contain `removed branch`

#### Scenario: Branch step is last

- **WHEN** the local branch cannot be deleted because another worktree has it checked out
- **THEN** the variant worktree is already gone, the branch still exists, and the error names the branch

#### Scenario: Remote branch stays

- **WHEN** the local branch `feat/demo` has an upstream and implode removes the local branch
- **THEN** the upstream branch still exists

#### Scenario: Unmerged with force

- **WHEN** the variant is unmerged, `force` is given, and `branchRm` is omitted
- **THEN** the local branch is gone

#### Scenario: Refusal leaves the branch

- **WHEN** the variant is unmerged and `force` is not given
- **THEN** implode fails and the local branch still exists

#### Scenario: Leftover branch without a worktree

- **WHEN** variant `demo` has no worktree, local branch `feat/demo` exists, and `branchRm` is omitted
- **THEN** the result reports that no worktree existed and the local branch `feat/demo` is gone

#### Scenario: No branch to remove

- **WHEN** variant `demo` has no worktree and no local branch for that slug
- **THEN** implode succeeds and a debug log event contains `demo` and says that no branch was removed

#### Scenario: Debug names a removed branch

- **WHEN** a user runs `variant implode -s demo --log-level=debug` for a merged variant on `feat/demo`
- **THEN** standard error contains a line that starts with `[debug]` and contains `feat/demo` and `removed`

#### Scenario: Default log hides the branch line

- **WHEN** a user runs `variant implode -s demo` with no log flag for that same variant
- **THEN** standard error does not contain a line that starts with `[debug]`

#### Scenario: Kept branch is debug

- **WHEN** a user runs `variant implode -s demo --branch-rm=no --log-level=debug` for a merged variant on `feat/demo`
- **THEN** standard error contains a line that starts with `[debug]` and contains `feat/demo` and `kept`
- **AND** the local branch `feat/demo` still exists

#### Scenario: True and false are rejected

- **WHEN** a user runs `variant implode -s demo --branch-rm=true` or `--branch-rm=false`
- **THEN** the command fails before teardown, the error names `yes` and `no`, and the worktree and the branch stay
