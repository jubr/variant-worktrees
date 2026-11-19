## MODIFIED Requirements

### Requirement: Vscode log stream

The CLI SHALL send each log event to vscode on the project Unix socket, except an event whose step is `ipc`, `cli` or `watch-cleanup`. Those steps (`connected`, `connect failed`, `write failed` and `end` of `ipc` and `cli`, and every event of `watch-cleanup`) SHALL be written to standard error when they meet the threshold and SHALL NOT be sent on the socket. The socket path SHALL be the path resolved for the process working directory. The CLI SHALL NOT connect while attaching the log sink. The first event SHALL start the only connection attempt. A later event SHALL NOT open a second connection.

When the attempt succeeds, the CLI SHALL emit one debug event whose step is `ipc` and whose message is `connected`. When the attempt fails, the CLI SHALL emit one debug event whose step is `ipc` and whose message is `connect failed: ` followed by the reason. A missing socket file SHALL use `file not found`. A refused connection SHALL use `connection refused`. A permission failure SHALL use `permission denied`. Any other failure SHALL use that error's text. The CLI SHALL NOT emit that outcome again. A failed attempt SHALL NOT fail the command, SHALL NOT write a log event to standard output, and SHALL NOT create the socket file.

Each event that is sent SHALL be one request line whose `name` is `log` and whose `args` carry `level`, `message`, `origin` `cli`, `step` when the event has a step, and `slug` when the event has a slug. When the event has no slug and the command was given an explicit slug (`-s` or `--slug`), `args.slug` SHALL be that slug. When the event has no slug and the command was not given an explicit slug, `args.slug` SHALL be the autodetected slug of the working directory, including `main` for the primary checkout. When that slug cannot be derived and no explicit slug was given, `args.slug` SHALL be omitted and the command SHALL still succeed. An event that already has a slug SHALL keep it. Events emitted before the attempt settles SHALL be sent, in that order, after a successful connect. When the attempt fails, those events SHALL NOT be sent. A request that fails after a successful connect SHALL NOT fail the command and SHALL NOT start another attempt.

A single write SHALL NOT wait longer than 1 second. When a write does not finish within that time after the connected debug event was emitted, the CLI SHALL drop the socket and SHALL NOT connect again. It SHALL emit one warn event whose step is `ipc` and whose message is `write failed`, and SHALL NOT emit that warn again. Later events SHALL NOT be sent and SHALL NOT wait on the socket.

When the CLI finishes and the log sink is attached, including when the command fails, the CLI SHALL emit one debug event whose step is `cli` and whose message is `end`, and SHALL wait until queued socket sends have finished or the attempt has failed before the process exits. The `end` event SHALL NOT be a socket request. The stderr threshold SHALL still apply. An event below the threshold SHALL still be sent on the socket. The slug SHALL NOT be printed on stderr. Standard error SHALL NOT contain ` [cli]` or ` @cli`.

#### Scenario: Event reaches a listening vscode

- **WHEN** a listener is accepting connections on the project socket and the CLI emits an info event with message `+"mise install"`, step `create`, and slug `add-auth`
- **THEN** the listener receives a request named `log` whose args are level `info`, that message, step `create`, slug `add-auth`, and origin `cli`
- **AND** standard output does not contain `+"mise install"`

#### Scenario: Autodetected slug fills a bare event

- **WHEN** the CLI runs in the primary checkout with no explicit slug and emits an info event `ready` with no slug
- **THEN** the request has slug `main`
- **AND** standard error does not contain `main`

#### Scenario: Explicit slug fills a bare event

- **WHEN** the CLI runs in the primary checkout with `-s release-smoke` and emits a debug event `ready` with no slug
- **THEN** the request slug is `release-smoke`
- **AND** the request slug is not `main`
- **AND** standard error does not contain `release-smoke`
- **AND** the listener receives no request whose step is `ipc` or `cli`

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
- **AND** the listener receives no request whose step is `ipc` or `cli`

#### Scenario: Default threshold hides the socket debug

- **WHEN** no listener is bound and a user runs `variant list` with no log flag
- **THEN** standard error does not contain a line that starts with `[debug]`

#### Scenario: Below the threshold still goes to the socket

- **WHEN** the threshold is `warn`, a listener is accepting connections, and an info event is emitted
- **THEN** standard error does not contain that event's message
- **AND** the listener receives a `log` request for that info event

#### Scenario: Watch cleanup stays local

- **WHEN** a listener is accepting connections and the CLI emits a warn event with step `watch-cleanup`
- **THEN** standard error contains that event's message
- **AND** the listener receives no request for it
