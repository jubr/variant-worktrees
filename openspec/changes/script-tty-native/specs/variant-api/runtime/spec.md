## MODIFIED Requirements

### Requirement: Watch output terminal

A watch's output mode SHALL be `tty` or `no-tty`. `variant.watches.<name>.output.mode` sets it. When that is unset, the mode SHALL be the default the caller passed, and `no-tty` when the caller passed none. An explicit mode SHALL win over the caller's default. `no-tty` SHALL start the process with pipes, so neither stdout nor stderr is a terminal. `tty` SHALL start the process with stdout and stderr attached to one pseudo-terminal, so both are a terminal, and that terminal SHALL be at least 1000 columns wide. The watch SHALL NOT start a program named `script` to allocate that terminal. Under Bun, the terminal SHALL be allocated when `script` is absent from `PATH`. Under Node, the terminal SHALL be allocated by executing `bun` resolved from `PATH`, or, when `PATH` has no `bun`, from Mise when this process can resolve Mise. That Node allocation SHALL succeed when `bun` is on `PATH` even when `script` is absent from `PATH`. Under Node, when `PATH` has no `bun` and Mise cannot resolve `bun`, the watch SHALL fail to start, the error message SHALL contain the watch name, and the watch command SHALL NOT be left running. When `TERM` is unset or `dumb`, the process environment SHALL set `TERM` to `xterm-256color`. Any other `TERM` SHALL be left as it is. A line the process writes only because it has a terminal, including an ANSI color sequence, SHALL appear in `.cache/variant/watch.log` and, for an attached watch, on standard output. A `tty` line that contains an ANSI escape SHALL have the reset sequence ESC `[0m` appended before the newline. When any watch runs as `tty`, the first line of `.cache/variant/watch.log` SHALL be one line, `[watch] {args} mode=tty # set to 'no-tty' likely suppresses ansi escape sequences`, before the `[name] {command}` banners. `{args}` is the flags of this invocation, such as `--detach`, and is omitted when none were set. The terminal's stdin SHALL stay open for the life of the process, so a program that exits on end-of-file keeps running. A line the process writes to stderr SHALL be part of that same transcript. The four bytes `^D` and two backspaces that the terminal allocator writes when its input is closed SHALL NOT appear in the log or on standard output. A detached `tty` watch SHALL write that transcript to the log and SHALL NOT write it to the caller's terminal. `down` SHALL stop a running `tty` watch command.

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

#### Scenario: Bun allocates a terminal without script

- **WHEN** Bun runs an attached `watch` with `output.mode: tty`, `PATH` does not contain `script`, and the command writes `tty` and an ANSI green line only when stdout is a terminal
- **THEN** standard output and `.cache/variant/watch.log` contain `[fe] tty` and the green line
- **AND** no process of the watch is the program `script`

#### Scenario: Node allocates a terminal with bun and without script

- **WHEN** Node runs an attached `watch` with `output.mode: tty`, `PATH` contains `bun`, `PATH` does not contain `script`, and the command writes `tty` only when stdout is a terminal
- **THEN** `.cache/variant/watch.log` contains `[fe] tty`
- **AND** no process of the watch is the program `script`

#### Scenario: Node without bun fails the terminal watch

- **WHEN** Node runs a `watch` with `output.mode: tty`, `PATH` contains neither `bun` nor `script`, and Mise cannot resolve `bun`
- **THEN** the call fails with an error that contains the watch name
- **AND** the watch command is not running

#### Scenario: Down stops a terminal watch

- **WHEN** a `tty` watch is running and `down` runs for that variant
- **THEN** the watch command is not running
