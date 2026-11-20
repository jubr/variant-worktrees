## MODIFIED Requirements

### Requirement: Log level flag

The CLI SHALL accept a global `--log-level` whose value is `trace`, `debug`, `info`, `warn` or `error`. The value `warning` SHALL also be accepted and SHALL select `warn`; the help, the error message for a bad value and the documentation SHALL NOT name it. The flag SHALL be accepted before and after the command name. The default threshold SHALL be `warn`. The flags `-v`, `-vv` and `-vvv` (see Short verbosity flags) SHALL also set the threshold, and a given `--log-level` SHALL win over them. An event below the threshold SHALL NOT be written. An event at or above the threshold SHALL be written to standard error and SHALL NOT be written to standard output.

A written line SHALL start with `[trace]`, `[debug]`, `[info]`, `[warn]`, or `[error]`, using `warn` for a `warn` event. When the event has a step, that step SHALL be printed once, after the level bracket and one space, and the message SHALL follow the step after one space. When the step is absent, the message SHALL follow the level bracket after one space. The CLI SHALL NOT invent a step by reading brackets in the message. The CLI SHALL NOT rewrite a command message into `cmd=`. The event's slug SHALL NOT be printed.

When standard error is a terminal and `NO_COLOR` is unset, the line SHALL be colored and SHALL otherwise be the same characters. `[` and `]` SHALL be dark gray (`ESC[90m`). The level word SHALL be gray-blue for `trace` (`ESC[38;5;67m`), yellow for `debug` (`ESC[33m`), green for `info` (`ESC[32m`), orange for `warn` (`ESC[38;5;208m`), and red for `error` (`ESC[31m`). The step SHALL be cyan (`ESC[36m`). `ESC` is the byte `0x1B`. The default color SHALL be restored (`ESC[0m`) after `]` and, when a step is present, again after the step, so the message uses the terminal default. When standard error is not a terminal, or `NO_COLOR` is set, the line SHALL contain no ANSI sequence.

#### Scenario: Default shows the warning

- **WHEN** the configured database cannot be contacted and a user runs `variant list` with no log flag, and the project directory is not a known temporary directory
- **THEN** standard error contains a line that starts with `[warn]` and contains the contact warning
- **AND** standard output is the list text and does not contain that warning

#### Scenario: Error threshold hides the warning

- **WHEN** a user runs `variant list --log-level=error` and the configured database cannot be contacted
- **THEN** standard error does not contain the contact warning
- **AND** standard output is the list and the process exits 0

#### Scenario: Trace flag

- **WHEN** a user runs `variant list --log-level=trace` and the library emits a trace event during that command
- **THEN** standard error contains a line that starts with `[trace]`

#### Scenario: Flag before the command

- **WHEN** a user runs `variant --log-level=debug list`
- **THEN** the threshold is `debug`

#### Scenario: Warning alias

- **WHEN** a user runs `variant list --log-level=warning`
- **THEN** the threshold is `warn`

#### Scenario: Bad value

- **WHEN** a user runs `variant list --log-level=loud`
- **THEN** the process exits non-zero, standard error names `--log-level` and the allowed values `trace`, `debug`, `info`, `warn`, `error`, and not `warning`, and the command does not run

#### Scenario: Step from the event

- **WHEN** an info event is written with message `+"mise install"`, step `create`, and slug `add-auth`
- **THEN** the line's text is `[info] create +"mise install"`
- **AND** the line does not contain `add-auth` or `cmd=`

#### Scenario: No step

- **WHEN** an info event is written whose message is `ready` and which has no step
- **THEN** the line's text is `[info] ready`

#### Scenario: Brackets in the message are not a step

- **WHEN** an info event is written with message `[provision] create schema app` and no step
- **THEN** the line's text is `[info] [provision] create schema app`

#### Scenario: Colored line

- **WHEN** standard error is a terminal, `NO_COLOR` is unset, and an info event with step `create` and message `+"mise install"` is written
- **THEN** the line is dark-gray `[`, green `info`, dark-gray `]`, a reset, cyan `create`, a reset, then ` +"mise install"`

#### Scenario: Plain line

- **WHEN** standard error is not a terminal, or `NO_COLOR` is set, and a warn event whose message does not begin with `[` is written
- **THEN** the line starts with `[warn]`, contains the message, and contains no ANSI sequence

## REMOVED Requirements

### Requirement: Verbose is not a log level

**Reason**: `-v` now selects the log level (see Short verbosity flags), so it can no longer be the short form of `--verbose`. `--verbose` keeps its meaning as richer command output and still does not change the log threshold.

**Migration**: Use `--verbose` where `-v` printed richer command output; use `-v` for log lines.

## ADDED Requirements

### Requirement: Short verbosity flags

The CLI SHALL accept the global flags `-v`, `-vv` and `-vvv`, before and after the command name. `-v` SHALL set the log threshold to `info`, `-vv` to `debug` and `-vvv` to `trace`. A longer run of `v` SHALL select `trace`. When `--log-level` is also given, it SHALL win. `-v` SHALL NOT be the short form of `--verbose`, and no command SHALL declare a short flag `-v`. `--verbose` SHALL keep its meaning as richer command output and SHALL NOT change the log threshold.

#### Scenario: One v is info

- **WHEN** a user runs `variant -v list` or `variant list -v` and the library emits an info event
- **THEN** standard error contains a line that starts with `[info]`
- **AND** standard output is the list text and not the verbose list

#### Scenario: Two and three v

- **WHEN** a user runs `variant list -vv` and the library emits a debug event
- **THEN** standard error contains a line that starts with `[debug]`
- **AND** with `-vvv` and a trace event, it contains a line that starts with `[trace]`

#### Scenario: Log level wins

- **WHEN** a user runs `variant list -vvv --log-level=error`
- **THEN** the threshold is `error`

#### Scenario: Verbose stays a richer result

- **WHEN** a user runs `variant list --verbose` and the library emits a debug event during that command
- **THEN** standard output is the verbose list text
- **AND** standard error does not contain a line that starts with `[debug]`
