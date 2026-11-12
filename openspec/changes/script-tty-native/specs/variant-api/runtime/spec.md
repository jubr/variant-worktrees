## MODIFIED Requirements

### Requirement: Watch output terminal

A watch's output mode SHALL be `tty` or `no-tty`. `variant.watches.<name>.output.mode` sets it. When that is unset, the mode SHALL be the default the caller passed, and `no-tty` when the caller passed none. An explicit mode SHALL win over the caller's default. `no-tty` SHALL start the process with pipes, so neither stdout nor stderr is a terminal. `tty` SHALL start the process with stdout and stderr attached to one pseudo-terminal, so both are a terminal, and that terminal SHALL be at least 1000 columns wide, by the first allocator that works. A later allocator SHALL NOT be tried after an earlier one works. When this process is Bun, the terminal SHALL be allocated in this process, and Mise, a `bun` on `PATH`, and `script` SHALL NOT be run. Otherwise the watch SHALL try `mise exec -- bun` with the Mise executable this process already resolves, otherwise `mise exec bun@latest -- bun`, otherwise `bun` on `PATH`. Each of those SHALL run the same in-process allocator. Otherwise the watch SHALL try the `script` program. When none of these works, that watch SHALL start with pipes, as `no-tty` does, SHALL emit a warn-level log whose message names the watch and says the terminal was not allocated, SHALL append that same sentence to `.cache/variant/watch.log`, SHALL NOT write the `mode=tty` line because of that watch, and SHALL leave the watch command running. When `TERM` is unset or `dumb`, the process environment SHALL set `TERM` to `xterm-256color`. Any other `TERM` SHALL be left as it is. A line the process writes only because it has a terminal, including an ANSI color sequence, SHALL appear in `.cache/variant/watch.log` and, for an attached watch, on standard output. A `tty` line that contains an ANSI escape SHALL have the reset sequence ESC `[0m` appended before the newline. When any watch runs as `tty`, the first line of `.cache/variant/watch.log` SHALL be one line, `[watch] {args} mode=tty # set to 'no-tty' likely suppresses ansi escape sequences`, before the `[name] {command}` banners. `{args}` is the flags of this invocation, such as `--detach`, and is omitted when none were set. The terminal's stdin SHALL stay open for the life of the process, so a program that exits on end-of-file keeps running. A line the process writes to stderr SHALL be part of that same transcript. The four bytes `^D` and two backspaces that the terminal allocator writes when its input is closed SHALL NOT appear in the log or on standard output. A detached `tty` watch SHALL write that transcript to the log and SHALL NOT write it to the caller's terminal. `down` SHALL stop a running `tty` watch command.

#### Scenario: A terminal prints color

- **WHEN** attached `watch` runs a command with `output.mode: tty` that writes `tty` and an ANSI green line only when stdout is a terminal, and writes `oops` on stderr
- **THEN** standard output and `.cache/variant/watch.log` contain `[fe] tty`, the green line with its ANSI sequence followed by the reset sequence, and `[fe] oops`
- **AND** the first line of `.cache/variant/watch.log` is `[watch] mode=tty # set to 'no-tty' likely suppresses ansi escape sequences`
- **AND** the process is still running after that output, because stdin did not end
- **AND** neither contains the `^D` terminal-allocator echo

#### Scenario: Pipes stay plain

- **WHEN** a watch with `output.mode: no-tty` writes `pipe` when stdout is not a terminal, `plain` instead of a color line, and `oops` on stderr
- **THEN** standard output contains `[fe] pipe` and `[fe] plain` and does not contain an ANSI escape
- **AND** standard error contains `[fe] oops` and standard output does not

#### Scenario: Omitted mode is not a terminal

- **WHEN** a watch sets no `output.mode` and the caller passes no default, and the command writes `tty` or `pipe` from whether stdout is a terminal
- **THEN** standard output contains `[fe] pipe`

#### Scenario: Caller default is a terminal

- **WHEN** a watch sets no `output.mode`, the caller passes the default `tty`, and the command writes `tty` when stdout is a terminal
- **THEN** `.cache/variant/watch.log` contains `[fe] tty`

#### Scenario: Explicit mode wins

- **WHEN** a watch sets `output.mode: no-tty` and the caller passes the default `tty`
- **THEN** the process stdout is not a terminal

#### Scenario: Dumb TERM becomes a color terminal

- **WHEN** a watch sets `output.mode: tty` and `TERM` is `dumb`
- **THEN** the process environment has `TERM` `xterm-256color`

#### Scenario: Detached terminal output stays in the log

- **WHEN** `watch` runs detached with `output.mode: tty` and the command writes an ANSI green line because stdout is a terminal
- **THEN** `.cache/variant/watch.log` contains that line
- **AND** the caller's standard output does not

#### Scenario: Bun allocates a terminal in process

- **WHEN** Bun runs an attached `watch` with `output.mode: tty`, `script` is on `PATH`, Mise is available, and the command writes `tty` and an ANSI green line only when stdout is a terminal
- **THEN** standard output and `.cache/variant/watch.log` contain `[fe] tty` and the green line
- **AND** no process of the watch is the program `script`
- **AND** Mise was not run

#### Scenario: Mise project bun wins over later allocators

- **WHEN** the process is not Bun, `mise exec -- bun` can allocate a terminal, `mise exec bun@latest -- bun` would also succeed, `PATH` contains `bun`, and `script` is on `PATH`
- **THEN** the watch command's stdout is a terminal
- **AND** `mise exec bun@latest -- bun`, the `bun` on `PATH`, and `script` were not run

#### Scenario: Latest bun is next

- **WHEN** the process is not Bun, `mise exec -- bun` fails, `mise exec bun@latest -- bun` can allocate a terminal, `PATH` contains `bun`, and `script` is on `PATH`
- **THEN** the watch command's stdout is a terminal
- **AND** the `bun` on `PATH` and `script` were not run

#### Scenario: Path bun is next

- **WHEN** the process is not Bun, both `mise exec -- bun` and `mise exec bun@latest -- bun` fail, `PATH` contains `bun`, and `script` is on `PATH`
- **THEN** the watch command's stdout is a terminal
- **AND** `script` was not run

#### Scenario: Script is next

- **WHEN** the process is not Bun, both Mise `bun` attempts fail, `PATH` has no `bun`, `script` is on `PATH`, and the command writes `tty` and an ANSI green line only when stdout is a terminal
- **THEN** standard output and `.cache/variant/watch.log` contain `[fe] tty` and the green line
- **AND** neither contains the `^D` terminal-allocator echo
- **AND** the process is still running, because stdin did not end

#### Scenario: No allocator uses pipes and warns

- **WHEN** the process is not Bun, both Mise `bun` attempts fail, `PATH` has no `bun`, `script` is absent, and the command writes `pipe` when stdout is not a terminal
- **THEN** standard output contains `[fe] pipe`
- **AND** a warn-level log names the watch and says the terminal was not allocated
- **AND** `.cache/variant/watch.log` contains that same sentence and does not contain `mode=tty`
- **AND** the watch command is running

#### Scenario: Down stops a terminal watch

- **WHEN** a `tty` watch is running and `down` runs for that variant
- **THEN** the watch command is not running
