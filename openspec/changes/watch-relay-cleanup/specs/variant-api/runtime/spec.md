## ADDED Requirements

### Requirement: Detached watch follows its worktree

A detached `watch` SHALL check every `supervise.checkoutPollSeconds` while its processes run that the worktree directory it was started for still exists as the same directory. A directory that was removed and then partly recreated by a path that a watch process writes is not that directory. `supervise.checkoutPollSeconds` of 0 SHALL turn the check off. When the directory is gone, the detached watch SHALL stop every watch process together with its descendants and SHALL implode the variant, keeping the local branch. The implode SHALL succeed when the worktree directory, its `.cache/variant/` and its state are already gone. A detached watch of slug `main` SHALL only stop its processes: the primary checkout is never imploded. From the moment the directory is found gone, the detached watch SHALL NOT create or write any file or directory under the worktree path: no line of `.cache/variant/watch.log`, no `.cache/variant/in.sock`, no `state.yaml` or `runtime.yaml`. Output that the processes still produce while they stop SHALL be dropped. After the cleanup the relay SHALL end.

#### Scenario: Worktree removed under a detached watch

- **WHEN** a detached watch for slug `demo` runs, `checkoutPollSeconds` is 1, and the worktree directory is deleted
- **THEN** within a few seconds no watch process of `demo` runs, the database target of `demo` is dropped, and the relay has ended
- **AND** the worktree path does not exist

#### Scenario: Output while stopping is not written

- **WHEN** a watch process prints a line on stderr while it is terminated after its worktree was deleted
- **THEN** no `.cache/variant/watch.log` exists afterwards under the worktree path, and neither does any other file below it

#### Scenario: Implode already removed the directory

- **WHEN** `variant implode` removes the worktree of `demo` while its detached watch runs
- **THEN** the watch processes stop, the relay ends, and the worktree path was not recreated

#### Scenario: Branch is kept

- **WHEN** the worktree directory of `demo` is deleted with `rm -rf` and branch `feat/demo` holds unmerged commits
- **THEN** the relay stops the processes and drops the database target, and `feat/demo` still exists

#### Scenario: Recreated directory is not the worktree

- **WHEN** the worktree directory is deleted and a watch process creates a directory at the same path before the next check
- **THEN** the detached watch still counts the worktree as gone

#### Scenario: Main is not imploded

- **WHEN** a detached watch of slug `main` finds the primary checkout directory gone
- **THEN** its processes are stopped, nothing is imploded, and no file is written under that path

#### Scenario: Check disabled

- **WHEN** `checkoutPollSeconds` is 0 and the worktree directory is deleted
- **THEN** the detached watch keeps running until it is stopped or its processes end

#### Scenario: Directory present

- **WHEN** the worktree directory still exists at every check
- **THEN** the watch processes keep running and no implode happens
