# variant-cli/logging Specification

## Purpose

Prints the variant log stream on the `variant` CLI and lets a person choose how much of it they see, without changing the command result on standard output.

## Requirements

### Requirement: Log level flag

The CLI SHALL accept a global `--log-level` whose value is `trace`, `debug`, `info`, `warn`, `error`, or `warning`. `warning` SHALL select `warn`. The flag SHALL be accepted before and after the command name. The default threshold SHALL be `warn`. An event below the threshold SHALL NOT be written. An event at or above the threshold SHALL be written to standard error and SHALL NOT be written to standard output.

A written line SHALL start with `[trace]`, `[debug]`, `[info]`, `[warn]`, or `[error]`, using `warn` for a `warn` event. When the event has a step, that step SHALL be printed once, after the level bracket and one space, and the message SHALL follow the step after one space. When the step is absent, the message SHALL follow the level bracket after one space. The CLI SHALL NOT invent a step by reading brackets in the message. The event's slug SHALL NOT be printed.

When standard error is a terminal and `NO_COLOR` is unset, the line SHALL be colored and SHALL otherwise be the same characters. `[` and `]` SHALL be dark gray (`ESC[90m`). The level word SHALL be gray-blue for `trace` (`ESC[38;5;67m`), yellow for `debug` (`ESC[33m`), green for `info` (`ESC[32m`), orange for `warn` (`ESC[38;5;208m`), and red for `error` (`ESC[31m`). The step SHALL be cyan (`ESC[36m`). `ESC` is the byte `0x1B`. The default color SHALL be restored (`ESC[0m`) after `]` and, when a step is present, again after the step, so the message uses the terminal default. When standard error is not a terminal, or `NO_COLOR` is set, the line SHALL contain no ANSI sequence.

#### Scenario: Default shows the warning

- **WHEN** the configured database cannot be contacted and a user runs `variant list` with no log flag
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
- **THEN** the process exits non-zero, standard error names `--log-level` and the allowed values, and the command does not run

#### Scenario: Step from the event

- **WHEN** an info event is written with message `+ mise install`, step `create`, and slug `add-auth`
- **THEN** the line's text is `[info] create + mise install`
- **AND** the line does not contain `add-auth`

#### Scenario: No step

- **WHEN** an info event is written whose message is `listed variants` and which has no step
- **THEN** the line's text is `[info] listed variants`

#### Scenario: Brackets in the message are not a step

- **WHEN** an info event is written with message `[provision] create schema app` and no step
- **THEN** the line's text is `[info] [provision] create schema app`

#### Scenario: Colored line

- **WHEN** standard error is a terminal, `NO_COLOR` is unset, and an info event with step `create` and message `+ mise install` is written
- **THEN** the line is dark-gray `[`, green `info`, dark-gray `]`, a reset, cyan `create`, a reset, then ` + mise install`

#### Scenario: Plain line

- **WHEN** standard error is not a terminal, or `NO_COLOR` is set, and a warn event whose message does not begin with `[` is written
- **THEN** the line starts with `[warn]`, contains the message, and contains no ANSI sequence

### Requirement: Verbose is not a log level

`-v` and `--verbose` SHALL keep their meaning as richer command output. They SHALL NOT change the log threshold.

#### Scenario: Verbose list stays a richer result

- **WHEN** a user runs `variant list -v` and the library emits a debug event during that command
- **THEN** standard output is the verbose list text
- **AND** standard error does not contain a line that starts with `[debug]`

### Requirement: Vscode log stream

The CLI SHALL send each log event to vscode on the project Unix socket. The socket path SHALL be the path resolved for the process working directory. The CLI SHALL NOT connect while attaching the log sink. The first event SHALL start the only connection attempt. A later event SHALL NOT open a second connection.

When the attempt succeeds, the CLI SHALL emit one debug event whose step is `ipc` and whose message is `connected`. When the attempt fails, the CLI SHALL emit one debug event whose step is `ipc` and whose message is `connect failed: ` followed by the reason. A missing socket file SHALL use `file not found`. A refused connection SHALL use `connection refused`. A permission failure SHALL use `permission denied`. Any other failure SHALL use that error's text. The CLI SHALL NOT emit that outcome again. A failed attempt SHALL NOT fail the command, SHALL NOT write a log event to standard output, and SHALL NOT create the socket file.

Each event SHALL be one request line whose `name` is `log` and whose `args` carry `level`, `message`, `origin` `cli`, `step` when the event has a step, and `slug` when the event has a slug. When the event has no slug, `args.slug` SHALL be the autodetected slug of the working directory, including `main` for the primary checkout. When that slug cannot be derived, `args.slug` SHALL be omitted and the command SHALL still succeed. Events emitted before the attempt settles SHALL be sent, in that order, after a successful connect. When the attempt fails, those events SHALL NOT be sent. A request that fails after a successful connect SHALL NOT fail the command and SHALL NOT start another attempt.

A single write SHALL NOT wait longer than 1 second. When a write does not finish within that time after the connected debug event was emitted, the CLI SHALL drop the socket and SHALL NOT connect again. It SHALL emit one warn event whose step is `ipc` and whose message is `write failed`, and SHALL NOT emit that warn again. Later events SHALL NOT be sent and SHALL NOT wait on the socket.

When the CLI finishes and the log sink is attached, including when the command fails, the CLI SHALL emit one debug event whose step is `cli` and whose message is `end`, and SHALL wait until that event has been sent or the attempt has failed before the process exits. The stderr threshold SHALL still apply. An event below the threshold SHALL still be sent on the socket. The slug SHALL NOT be printed on stderr. Standard error SHALL NOT contain ` [cli]`.

#### Scenario: Event reaches a listening vscode

- **WHEN** a listener is accepting connections on the project socket and the CLI emits an info event with message `+ mise install`, step `create`, and slug `add-auth`
- **THEN** the listener receives a request named `log` whose args are level `info`, that message, step `create`, slug `add-auth`, and origin `cli`
- **AND** standard output does not contain `+ mise install`

#### Scenario: Autodetected slug fills a bare event

- **WHEN** the CLI runs in the primary checkout and emits an info event `listed variants` with no slug
- **THEN** the request has slug `main`
- **AND** standard error does not contain `main`

#### Scenario: Connect waits for the first event

- **WHEN** the CLI has attached the log sink and no event has been emitted
- **THEN** no connection to the project socket has been attempted

#### Scenario: No socket leaves the command result

- **WHEN** no listener is bound and a user runs `variant list` for a project whose list exits 0
- **THEN** the process exits 0
- **AND** standard output is the list
- **AND** the CLI does not create the socket file

#### Scenario: Connect failure is one debug line

- **WHEN** no listener is bound and a user runs `variant list --log-level=debug` for that project
- **THEN** standard error contains one line whose text is `[debug] ipc connect failed`
- **AND** standard error contains one line whose text is `[debug] cli end`
- **AND** standard error does not contain a second `connect failed`

#### Scenario: Connect success is one debug line

- **WHEN** a listener is accepting connections and a user runs `variant list --log-level=debug` for that project
- **THEN** standard error contains one line whose text is `[debug] ipc connected`
- **AND** standard error contains one line whose text is `[debug] cli end`
- **AND** standard error does not contain `connect failed`

#### Scenario: Default threshold hides the socket debug

- **WHEN** no listener is bound and a user runs `variant list` with no log flag
- **THEN** standard error does not contain a line that starts with `[debug]`

#### Scenario: Below the threshold still goes to the socket

- **WHEN** the threshold is `warn`, a listener is accepting connections, and an info event is emitted
- **THEN** standard error does not contain that event's message
- **AND** the listener receives a `log` request for that info event
