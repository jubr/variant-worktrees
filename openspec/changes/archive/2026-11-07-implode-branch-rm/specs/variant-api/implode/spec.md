## MODIFIED Requirements

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

## ADDED Requirements

### Requirement: Implode removes the local branch last

The system SHALL, as the last step of an implode that passed the merge gate, remove the variant's local git branch when `branchRm` is `yes` or omitted, and SHALL keep that branch when `branchRm` is `no`. It SHALL NOT remove a remote branch. A refusal of implode SHALL leave the branch in place.

The branch SHALL be the one checked out in the variant worktree, read before that worktree is removed. A detached HEAD has no branch to remove. When the slug has no worktree, the branch SHALL be the first existing local branch named by `variant.branchPrefixes` plus the slug, in that list's order. When no such branch exists, the step SHALL remove nothing and the implode SHALL still succeed.

The worktree removal SHALL complete before the branch is deleted. When the branch cannot be deleted, the implode SHALL fail, the error SHALL name the branch, and the branch SHALL still exist. The text summary SHALL contain `removed branch <name>` when the branch was removed, and SHALL NOT contain that line when the branch was kept or none existed. The result SHALL name the branch and whether it was removed.

The branch step SHALL emit one debug log event. When the branch is removed, the message SHALL contain the branch name and `removed`. When `branchRm` is `no` and the branch exists, the message SHALL contain the branch name and `kept`. When no branch exists, the message SHALL contain the slug and say that no branch was removed. With the default log threshold the CLI SHALL NOT write that event. With `--log-level=debug` the CLI SHALL write it to standard error as a line that starts with `debug:`.

A `branchRm` value other than `yes`, `no`, or omitted SHALL fail before any teardown, and the error SHALL name `yes` and `no`.

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
- **THEN** standard error contains a line that starts with `debug:` and contains `feat/demo` and `removed`

#### Scenario: Default log hides the branch line

- **WHEN** a user runs `variant implode -s demo` with no log flag for that same variant
- **THEN** standard error does not contain a line that starts with `debug:`

#### Scenario: Kept branch is debug

- **WHEN** a user runs `variant implode -s demo --branch-rm=no --log-level=debug` for a merged variant on `feat/demo`
- **THEN** standard error contains a line that starts with `debug:` and contains `feat/demo` and `kept`
- **AND** the local branch `feat/demo` still exists

#### Scenario: True and false are rejected

- **WHEN** a user runs `variant implode -s demo --branch-rm=true` or `--branch-rm=false`
- **THEN** the command fails before teardown, the error names `yes` and `no`, and the worktree and the branch stay
