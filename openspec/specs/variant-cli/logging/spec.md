# variant-cli/logging Specification

## Purpose

Prints the variant log stream on the `variant` CLI and lets a person choose how much of it they see, without changing the command result on standard output.

## Requirements

### Requirement: Log level flag

The CLI SHALL accept a global `--log-level` whose value is `trace`, `debug`, `info`, `warn`, `error`, or `warning`. `warning` SHALL select `warn`. The flag SHALL be accepted before and after the command name. The default threshold SHALL be `warn`. An event below the threshold SHALL NOT be written. An event at or above the threshold SHALL be written to standard error and SHALL NOT be written to standard output. A `warn` line SHALL start with `warning:`, an `error` line with `error:`, an `info` line with `info:`, a `debug` line with `debug:`, and a `trace` line with `trace:`.

#### Scenario: Default shows the warning

- **WHEN** the configured database cannot be contacted and a user runs `variant list` with no log flag
- **THEN** standard error contains a line that starts with `warning:` and contains the contact warning
- **AND** standard output is the list text and does not contain that warning

#### Scenario: Error threshold hides the warning

- **WHEN** a user runs `variant list --log-level=error` and the configured database cannot be contacted
- **THEN** standard error does not contain the contact warning
- **AND** standard output is the list and the process exits 0

#### Scenario: Trace flag

- **WHEN** a user runs `variant list --log-level=trace` and the library emits a trace event during that command
- **THEN** standard error contains a line that starts with `trace:`

#### Scenario: Flag before the command

- **WHEN** a user runs `variant --log-level=debug list`
- **THEN** the threshold is `debug`

#### Scenario: Warning alias

- **WHEN** a user runs `variant list --log-level=warning`
- **THEN** the threshold is `warn`

#### Scenario: Bad value

- **WHEN** a user runs `variant list --log-level=loud`
- **THEN** the process exits non-zero, standard error names `--log-level` and the allowed values, and the command does not run

### Requirement: Verbose is not a log level

`-v` and `--verbose` SHALL keep their meaning as richer command output. They SHALL NOT change the log threshold.

#### Scenario: Verbose list stays a richer result

- **WHEN** a user runs `variant list -v` and the library emits a debug event during that command
- **THEN** standard output is the verbose list text
- **AND** standard error does not contain a line that starts with `debug:`
