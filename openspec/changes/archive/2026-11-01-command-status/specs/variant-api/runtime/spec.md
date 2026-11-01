## ADDED Requirements

### Requirement: Detached watch log

A `watch` with the `detach` option SHALL write the stdout and stderr of every process it starts, interleaved as they are produced, to one log file named `variants.watch.log` next to the `variants.local.yaml` of the variant (git-ignored, removed with the worktree). It SHALL truncate that file when it starts, write the line `[<key>] <command>` for each process before it starts, and record the absolute path as `runtime.log`. Output SHALL reach the file while the processes run, so a reader can follow it with `tail -f`. An attached `watch` SHALL keep its output on the console, write no log file, and record no `log`. `down` SHALL remove `runtime.log` from the runtime state and keep the file. `up` SHALL write no log file.

#### Scenario: Detached output reaches the file

- **WHEN** `watch` runs detached with a command that prints `ready` and keeps running
- **THEN** `variants.watch.log` contains `ready` while the process still runs

#### Scenario: Log path recorded

- **WHEN** `watch` runs detached for slug `demo`
- **THEN** `variants.local.yaml` holds `runtime.log` with the absolute path of `variants.watch.log`

#### Scenario: Two processes, one file

- **WHEN** instances `be` and `fe` both print a line and run detached
- **THEN** both lines are in the same file, below the lines `[be] <command>` and `[fe] <command>`

#### Scenario: Restart truncates

- **WHEN** a detached watch runs again for the same variant
- **THEN** the file holds only the output of the new run

#### Scenario: Attached keeps the console

- **WHEN** `watch` runs attached
- **THEN** the output goes to the console, no log file is written and no `runtime.log` is recorded

#### Scenario: Down drops the record

- **WHEN** `down` stops a detached watch
- **THEN** `runtime.log` is no longer in the runtime state and the file still exists
