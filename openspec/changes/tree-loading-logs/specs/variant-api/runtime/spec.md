## MODIFIED Requirements

### Requirement: The watch command runs watches as host processes

The system SHALL start the `watch` command of every watch as a process in the watch directory with the command environment, and SHALL record the process id of each in the runtime state. Stdout and stderr of those processes SHALL be captured and written by the watch output log, for an attached watch and for a detached watch. A watch without a `watch` command SHALL NOT be started. Watches SHALL start in their listed order, waiting `supervise.startDelaySeconds` between two of them. The command SHALL print the command line it runs for each watch.

#### Scenario: Two watchers

- **WHEN** watches `be` and `fe` both have a `watch` command
- **THEN** both processes run in their directories, `be` starts first, and their pids are recorded

#### Scenario: Watch without watch command

- **WHEN** watch `be` has no `watch` command and `fe` has one
- **THEN** only `fe` is started

#### Scenario: Variant-wide command

- **WHEN** no watch has `watch`
- **THEN** no process is started, whatever else the configuration holds

### Requirement: Readiness and opening

The system SHALL, after watches start in attached `up` and attached `watch`, poll once per second for every watch that sets `ready`, up to `supervise.readyTimeoutSeconds`. When that watch has a URL template, the polled URL SHALL be the rendered watch URL joined with `ready`, keeping one slash. Otherwise the polled URL SHALL be `http://127.0.0.1:<port><ready>`. A response SHALL count only when its status is 200. On the first poll of a watch the command SHALL write `[watch] {name} URL try {url}` to standard error, where `{name}` is the watch key and `{url}` is the polled URL. On the first status 200 it SHALL write `[watch] {name} URL 200 {url}` to standard error. It SHALL NOT write either line again for that watch. When `watch` is writing `.cache/variant/watch.log`, those same lines SHALL be appended there. When every such watch has returned 200, the command SHALL open the URL of each watch with a `url` template in the system browser, unless opening is disabled. When no watch sets `ready` it SHALL print and open the URLs right after start and SHALL NOT write a URL try line. On timeout it SHALL print a warning, open nothing, and leave the watches running. Failure to launch a browser SHALL NOT fail the command. `variant.open` set to false, and `VARIANT_OPEN=0`, SHALL disable opening. A detached `watch` SHALL NOT poll and SHALL NOT open URLs.

#### Scenario: Open after ready

- **WHEN** `be` has `ready: /health` that starts answering after 2 seconds and `fe` has a `url` template
- **THEN** the URL of `fe` is opened after `be` answers

#### Scenario: Open disabled

- **WHEN** `variant.open` is `false` and a watch returns 200
- **THEN** standard error contains the URL 200 line and no browser is launched

#### Scenario: Environment disables opening

- **WHEN** `VARIANT_OPEN` is `0` and every ready watch returns 200
- **THEN** no browser is launched

#### Scenario: Ready timeout

- **WHEN** a watch never answers within `readyTimeoutSeconds`
- **THEN** a warning is printed, no URL is opened, and the watches keep running

#### Scenario: First probe logs the full URL

- **WHEN** watch `be` has URL `http://demo.vw.localhost:62061` and `ready: /health`, and attached `watch` polls it for the first time
- **THEN** standard error contains `[watch] be URL try http://demo.vw.localhost:62061/health`
- **AND** `.cache/variant/watch.log` contains that same line

#### Scenario: First 200 logs once

- **WHEN** that URL then returns status 200 for the first time
- **THEN** standard error contains `[watch] be URL 200 http://demo.vw.localhost:62061/health`
- **AND** a later poll of `be` does not write that try line or that 200 line again

#### Scenario: Status 204 is not ready

- **WHEN** the ready URL returns status 204 until `readyTimeoutSeconds` elapses
- **THEN** no URL 200 line is written, a warning is printed, and no URL is opened

#### Scenario: No URL template uses the loopback URL

- **WHEN** watch `be` sets `ready: /health`, has no URL template, and is on port 62061
- **THEN** the first probe line is `[watch] be URL try http://127.0.0.1:62061/health`

#### Scenario: Detach does not probe

- **WHEN** `watch` runs with `detach` and a watch sets `ready`
- **THEN** no URL try line is written and no browser is launched

## REMOVED Requirements

### Requirement: Detached watch log

**Reason**: Attached and detached `watch` now record the same prefixed log.
**Migration**: Watch output log.

## ADDED Requirements

### Requirement: Watch output log

`watch` SHALL capture stdout and stderr of every process it starts, attached or detached. Each complete line from a process's stdout SHALL be written to standard output as `[{name}] {line}`. Each complete line from a process's stderr SHALL be written to standard error as `[{name}] {line}`. `{name}` is the watch key. A trailing partial line SHALL be written the same way when the stream ends. The same prefixed line SHALL be appended to `.cache/variant/watch.log` in the variant directory. Appending that line SHALL NOT block the write to standard output or standard error. The file is git-ignored and removed with the worktree. `watch` SHALL truncate the file when it starts, write the line `[{name}] {command}` for each process before it starts, and record the absolute path as `log` in `.cache/variant/state.yaml`. A line SHALL reach the file while the process still runs. A detached `watch` SHALL prefix and record lines the same way. After that call returns, capture SHALL keep writing the file until the processes end, and SHALL NOT write the caller's terminal. `down` SHALL remove `log` from the state file and keep the file. `up` SHALL write no log file.

#### Scenario: Attached stdout is prefixed and logged

- **WHEN** attached `watch` runs a command that prints `ready` on stdout and keeps running
- **THEN** standard output contains `[fe] ready` and `.cache/variant/watch.log` contains `[fe] ready` while the process still runs

#### Scenario: Stderr stays on stderr

- **WHEN** a watch prints `oops` on stderr
- **THEN** standard error contains `[fe] oops`, standard output does not, and the log file contains `[fe] oops`

#### Scenario: Log path recorded for an attached watch

- **WHEN** attached `watch` runs for slug `demo`
- **THEN** `state.yaml` holds `log` with the absolute path of `.cache/variant/watch.log`

#### Scenario: Detached output reaches the file

- **WHEN** `watch` runs detached with a command that prints `ready` and keeps running
- **THEN** `.cache/variant/watch.log` contains `[fe] ready` while the process still runs
- **AND** the caller's standard output does not contain that line

#### Scenario: Log path recorded

- **WHEN** `watch` runs detached for slug `demo`
- **THEN** `state.yaml` holds `log` with the absolute path of `.cache/variant/watch.log`

#### Scenario: Two processes, one file

- **WHEN** watches `be` and `fe` both print a line
- **THEN** both lines are in the same file, prefixed `[be]` and `[fe]`, below the lines `[be] {command}` and `[fe] {command}`

#### Scenario: Restart truncates

- **WHEN** `watch` runs again for the same variant
- **THEN** the file holds only the output of the new run

#### Scenario: Down drops the record

- **WHEN** `down` stops a watch that recorded `log`
- **THEN** `log` is no longer in `state.yaml` and the file still exists

#### Scenario: Up writes no watch log

- **WHEN** `up` runs
- **THEN** no `.cache/variant/watch.log` is written and no `log` is recorded
