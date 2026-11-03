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

The system SHALL, after the merge gate passes, perform the teardown that the core capability specifies for implode (stop the runtime, drop the database target, delete storage, clear state) before it continues with the worktree. When the slug has no worktree it SHALL finish after the teardown and report that no worktree existed. The git branch of the variant SHALL be kept.

#### Scenario: Teardown first

- **WHEN** a merged variant `demo` runs a watch and `implode` runs
- **THEN** the watch is stopped, its database target is dropped, and then the worktree is removed

#### Scenario: No worktree

- **WHEN** variant `demo` has a database target but no worktree
- **THEN** the target is dropped and the result reports that no worktree existed

#### Scenario: Branch kept

- **WHEN** the implode completes
- **THEN** the branch `feat/demo` still exists

### Requirement: Implode cleanup

The system SHALL, before the worktree report is taken and the worktree is removed, delete every path that matches a pattern of `variant.implode.preRm`, with `{{slug}}` replaced. A pattern SHALL be matched relative to the project directory and relative to each watch directory, so `dist` removes `fe/dist` and `be/dist` of watches in `fe` and `be`, and a dotfile or a directory such as `node_modules` is matched like any other name. A match that is, or contains, a file tracked by git SHALL be left in place. The system SHALL discard local modifications of tracked files whose base name is in `variant.implode.discard`, leaving other modified files as they are.

#### Scenario: Pre-removal directories

- **WHEN** `preRm` is `[dist, node_modules]`, a watch `fe` has `fe/dist` and `fe/node_modules`, and `implode` runs
- **THEN** both directories are gone before the worktree is removed

#### Scenario: Root directories

- **WHEN** `preRm` is `[node_modules]` and the project directory holds an untracked `node_modules`
- **THEN** it is deleted too

#### Scenario: Untracked recording removed

- **WHEN** `preRm` is `["openspec/changes/{{slug}}/pr*-demo.webm"]` and an untracked `openspec/changes/demo/pr7-demo.webm` exists
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

The system SHALL return and print, before removing the worktree, the output of `git status` and `git diff --stat` for the worktree, and the output of `git diff` when it has at most `variant.implode.maxDiffLines` lines. It SHALL print the report before discarding lockfile changes.

#### Scenario: Short diff shown

- **WHEN** the worktree diff has 12 lines and `maxDiffLines` is 200
- **THEN** the report contains the full diff

#### Scenario: Long diff summarized

- **WHEN** the worktree diff has 500 lines and `maxDiffLines` is 200
- **THEN** the report contains the status and the stat but not the full diff

#### Scenario: Worktree removed last

- **WHEN** the implode succeeds
- **THEN** the result names the removed worktree path and the directory no longer exists
