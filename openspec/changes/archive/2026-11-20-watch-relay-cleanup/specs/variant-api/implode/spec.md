## ADDED Requirements

### Requirement: Implode of a vanished worktree writes nothing there

When the worktree directory of the variant no longer exists, `implode` SHALL still stop what runs for the slug, drop its database target and storage that is still reachable, remove its state, run `git worktree prune`, and remove the local branch unless `branchRm` is `no`. It SHALL NOT create, write or recreate any file or directory under the missing worktree path, including `.cache/variant/` and its logs, runtime, state and socket files. When the caller asks for it, `implode` SHALL announce each of those actions before it runs, as the requirement Watch follows its worktree describes.

#### Scenario: Missing directory stays missing

- **WHEN** `implode` runs for `demo` and the directory of its worktree was deleted beforehand
- **THEN** the worktree path still does not exist afterwards and nothing was written below it

#### Scenario: Keep the branch

- **WHEN** that `implode` runs with `branchRm` set to `no`
- **THEN** the local branch `feat/demo` still exists and the database target of `demo` is dropped

#### Scenario: Actions are announced

- **WHEN** that `implode` runs for `demo` with announcements on
- **THEN** each of dropping the target, removing the state file (its absolute path), `git worktree prune` and keeping the branch is announced before it happens
