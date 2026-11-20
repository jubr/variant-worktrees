## ADDED Requirements

### Requirement: Watch follows its worktree

A `watch`, attached or detached, SHALL check every `supervise.checkoutPollSeconds` while its processes run that the worktree directory it was started for still exists as the same directory. A directory that was removed and then partly recreated by a path that a watch process writes is not that directory. `supervise.checkoutPollSeconds` of 0 SHALL turn the check off. When the directory is gone, the watch SHALL, in this order: stop writing under the worktree path, stop every watch process together with its descendants, and implode the variant keeping the local branch. A watch of slug `main` SHALL only stop its processes: the primary checkout is never imploded. The implode SHALL succeed when the worktree directory, its `.cache/variant/` and its state are already gone. From the moment the directory is found gone, the watch SHALL NOT create or write any file or directory under the worktree path: no line of `.cache/variant/watch.log`, no `.cache/variant/in.sock`, no `state.yaml` or `runtime.yaml`. Output that the processes still produce while they stop SHALL be dropped. A detached watch SHALL end after the cleanup.

The watch SHALL emit one log event at level `warn` with step `watch-cleanup` and the slug when it finds the worktree gone, naming the path and what follows (stopping the watches and, except for `main`, imploding the variant and keeping its branch). Before each action after that it SHALL emit a log event at level `debug` with the same step and slug: for each watch process it stops (the watch key and pid), for each file or directory it removes (the absolute path), for each container it removes (the name), when it drops the database target (the target), when it runs `git worktree prune`, and when it keeps the branch (the branch name, or that none exists). A failed implode SHALL be one further `warn` event naming the reason. These events follow the transport of any other library event: the CLI forwards them like its others, and they are never written to any file under the worktree path. A detached watch has no CLI, so it SHALL write them to the standard error of the command that started it when that is a terminal or a file, and SHALL write them nowhere when it is a pipe, so a caller that waits for the end of its pipe is not held by the watch. The known-temporary-directory rule applies to them like to any library event.

#### Scenario: Worktree removed under a detached watch

- **WHEN** a detached watch for slug `demo` runs, `checkoutPollSeconds` is 1, and the worktree directory is deleted
- **THEN** within a few seconds no watch process of `demo` runs, the database target of `demo` is dropped, and the relay has ended
- **AND** the worktree path does not exist

#### Scenario: Worktree removed under an attached watch

- **WHEN** an attached watch for slug `demo` runs, `checkoutPollSeconds` is 1, and the worktree directory is deleted
- **THEN** the watch processes are stopped, the database target of `demo` is dropped, the exit status is 1, and the worktree path does not exist

#### Scenario: Output while stopping is not written

- **WHEN** a watch process prints a line on stderr while it is terminated after its worktree was deleted
- **THEN** no `.cache/variant/watch.log` exists afterwards under the worktree path, and neither does any other file below it

#### Scenario: Implode already removed the directory

- **WHEN** `variant implode` removes the worktree of `demo` while its detached watch runs
- **THEN** the watch processes stop, the relay ends, and the worktree path was not recreated

#### Scenario: Branch is kept

- **WHEN** the worktree directory of `demo` is deleted with `rm -rf` and branch `feat/demo` holds unmerged commits
- **THEN** the watch stops the processes and drops the database target, and `feat/demo` still exists

#### Scenario: Recreated directory is not the worktree

- **WHEN** the worktree directory is deleted and a watch process creates a directory at the same path before the next check
- **THEN** the watch still counts the worktree as gone

#### Scenario: Main is not imploded

- **WHEN** a watch of slug `main` finds the primary checkout directory gone
- **THEN** its processes are stopped, nothing is imploded, and no file is written under that path

#### Scenario: Check disabled

- **WHEN** `checkoutPollSeconds` is 0 and the worktree directory is deleted
- **THEN** the watch keeps running until it is stopped or its processes end

#### Scenario: Directory present

- **WHEN** the worktree directory still exists at every check
- **THEN** the watch processes keep running and no implode happens

#### Scenario: One warning, then debug steps

- **WHEN** the worktree of `demo` is found gone and the cleanup stops pid 4242 of watch `fe`, removes `/work/.state/demo.yaml`, drops the target `v_demo` and runs `git worktree prune`, and the project directory is not a known temporary directory
- **THEN** the first event is a `warn` with step `watch-cleanup` and slug `demo` that names the missing worktree path
- **AND** the following events are `debug` events with that step and slug that name `fe` with pid 4242, that file path, `v_demo`, and `git worktree prune`, each before its action
- **AND** no other event of the cleanup is a `warn`

#### Scenario: Detached events reach the inherited standard error

- **WHEN** a detached watch was started by a command whose standard error is a file and its worktree is deleted
- **THEN** that file holds the `watch-cleanup` events and no file exists under the worktree path

#### Scenario: A pipe is not held open

- **WHEN** a detached watch was started by a command whose standard error is a pipe
- **THEN** the watch does not hold that pipe, and the reader of the pipe sees its end when the command ends

#### Scenario: Temporary directory emits trace

- **WHEN** the project directory is `/tmp/variant-app` and the cleanup runs
- **THEN** its events, the first one included, are emitted at `trace`

## MODIFIED Requirements

### Requirement: Watch supervision

The system SHALL keep an attached `watch` running until it is interrupted, a watch process ends, or the worktree directory disappears. On SIGINT or SIGTERM before a line `3`, including Ctrl+C from a terminal whose key reader is in raw mode, it SHALL terminate every watch process together with its descendants, remove the process ids from the runtime state, and end with exit status 130. When one watch process ends before a line `3`, it SHALL terminate the others and end with exit status 1. After a line `3`, a watch process ending SHALL leave the others running, and the call SHALL end with exit status 0 once none remain. When the worktree directory disappears (checked every `supervise.checkoutPollSeconds`) it SHALL clean up as the requirement Watch follows its worktree describes and end with exit status 1. When `watch` is given the `detach` option it SHALL start the processes detached from the console, write the runtime state, and return without waiting, readiness checks or opening URLs. When every watch command already has a live process, `watch` SHALL leave those processes running and return their process ids. It SHALL then write `[watch] # already running: reattached, showing last 50 lines` (the `#` clause in comment gray when color is on), the last 50 lines of `.cache/variant/watch.log`, `[watch] {name} URL 200 {url}` for each ready watch that answers 200, and the interactive command line. With `detach` it SHALL then return. Without `detach` it SHALL then follow lines appended to that log and SHALL read `1`, `2`, and `3` as the first run does. A line `2` SHALL return with exit status 0 and leave the processes running. A line `3` SHALL send SIGINT to the recorded processes and wait. The call SHALL end with exit status 0 once they have exited. A Ctrl+C less than 1 second after that SIGINT SHALL be ignored. A Ctrl+C at least 1 second later SHALL send SIGTERM and end with exit status 0. A line `1` SHALL stop them and start them again under this call. Any other line SHALL be written to the stdin of each running watch. An interrupt of that follow SHALL end with exit status 130 and SHALL NOT stop those processes. A recorded process that has exited SHALL still be replaced. On a terminal, a line `3` SHALL send SIGINT to every watch process and its descendants and then wait. The process SHALL exit with status 0 once every watch process has exited. A Ctrl+C less than 1 second after that SIGINT SHALL be ignored. A Ctrl+C at least 1 second later SHALL send SIGTERM to every watch process still running and the process SHALL exit with status 0. A line `2` SHALL return with exit status 0, the process SHALL exit so the shell returns, and the watch processes SHALL keep running. A line `1` SHALL stop the watch processes and start them again, and the watch SHALL keep running and SHALL accept `1`, `2`, and `3` again. Any other line SHALL be written to the stdin of each watch this call started.

#### Scenario: Interrupt

- **WHEN** an attached watch is interrupted with SIGINT
- **THEN** both watch processes and their children are terminated, no pid remains in the runtime state, and the exit status is 130

#### Scenario: Terminal Ctrl+C

- **WHEN** an attached watch is running on a terminal and the terminal sends Ctrl+C
- **THEN** the watch processes are terminated and the exit status is 130

#### Scenario: Quit waits for the watches

- **WHEN** an attached watch reads a line `3` and a watch process stays up after SIGINT
- **THEN** that process receives SIGINT, the call keeps waiting, and a Ctrl+C less than 1 second later does not send SIGTERM

#### Scenario: Second Ctrl+C after quit

- **WHEN** an attached watch reads a line `3` and Ctrl+C arrives at least 1 second later while a watch process is still running
- **THEN** that process receives SIGTERM and the exit status is 0

#### Scenario: One watch dies

- **WHEN** one of two watched processes exits on its own
- **THEN** the other is terminated and the exit status is 1

#### Scenario: Checkout removed

- **WHEN** the worktree directory is deleted while watching and `checkoutPollSeconds` is 1
- **THEN** the processes are terminated, the variant's database target is dropped, no file is written under the worktree path, and the exit status is 1

#### Scenario: Checkout check disabled

- **WHEN** `checkoutPollSeconds` is 0 and the worktree directory is deleted
- **THEN** the watch keeps running until interrupted or a watch ends

#### Scenario: Detached watch

- **WHEN** `watch` runs with `detach`
- **THEN** the call returns with the pids recorded in `.cache/variant/state.yaml` while the processes keep running

#### Scenario: Re-run leaves a live watch in place

- **WHEN** a watch for slug `demo` is already running and `watch` runs again with `detach`
- **THEN** the recorded processes keep running, the call returns those same process ids, and the report is `[watch] # already running: reattached, showing last 50 lines`, then at most the last 50 lines of `.cache/variant/watch.log`, then `[watch] {name} URL 200 {url}` for each ready watch that answers 200, then the interactive command line

#### Scenario: Attached re-run follows the log

- **WHEN** a watch for slug `demo` is already running and `watch` runs again without `detach`, and a line is appended to `.cache/variant/watch.log` after the report
- **THEN** that line is written to stderr, an interrupt ends the call with exit status 130, and the recorded processes keep running

#### Scenario: Attached re-run reads keys and stdin

- **WHEN** a watch is already running and `watch` runs again without `detach`
- **THEN** a line `3` sends SIGINT and returns exit status 0 once the recorded processes have exited, a Ctrl+C at least 1 second later sends SIGTERM and returns exit status 0, a line `2` returns exit status 0 and leaves them running, a line `1` starts them again, and any other line is written to each watch's stdin
