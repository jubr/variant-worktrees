# variant-vscode Specification

## Purpose

The extension hosts the project Unix socket for requests that need the editor. Lifecycle commands stay in `variant-api`.

## Requirements

### Requirement: Activation binds the resolved socket

When the extension activates, it SHALL listen on `{resolveMainVscodeDir}/variant-worktrees.sock` for the workspace folder. Distinct socket paths SHALL each get a listener. Repeated resolutions of one path SHALL share one listener. When no workspace folder is open, it SHALL NOT create a socket.

#### Scenario: Worktree workspace in a symlink container

- **WHEN** the extension activates with workspace folder `/work/vw/_v-lib-ipc` in the linked checkout layout
- **THEN** a listener accepts connections on `/work/vw/variant-worktrees/.vscode/variant-worktrees.sock`
- **AND** `/work/vw/_v-lib-ipc/.vscode/variant-worktrees.sock` is absent

#### Scenario: Main checkout workspace

- **WHEN** the extension activates with workspace folder `/work/vw/variant-worktrees` in the linked checkout layout
- **THEN** a listener accepts connections on `/work/vw/variant-worktrees/.vscode/variant-worktrees.sock`

#### Scenario: Single-repo workspace

- **WHEN** the extension activates with workspace folder `/work/_v-lib-ipc` in the single-repo layout
- **THEN** a listener accepts connections on `/work/.vscode/variant-worktrees.sock`

#### Scenario: Two folders, one socket path

- **WHEN** the extension activates with workspace folders `/work/vw` and `/work/vw/variant-worktrees` and both resolve to `/work/vw/variant-worktrees/.vscode/variant-worktrees.sock`
- **THEN** one listener accepts connections on that path

#### Scenario: No workspace folder

- **WHEN** the extension activates with no workspace folder
- **THEN** it does not create `.vscode/variant-worktrees.sock`

### Requirement: Lifecycle commands are not handled here

The extension's socket SHALL NOT execute `config`, `create`, `list`, `provision`, `up`, `down`, `watch`, or `implode`. A socket request with one of those names SHALL fail and SHALL NOT call `variant-api`. This restriction applies to requests that arrive on the socket only: the extension's own views MAY call `variant-api` in-process for `list`, `watch`, `down` and `implode`, and those calls SHALL NOT be reachable from the socket.

#### Scenario: Create is refused

- **WHEN** a client sends `{"name":"create","args":{"slug":"test-feature"}}` to the extension socket
- **THEN** the response line has a non-empty `error.message`
- **AND** `variant-api` create does not run

#### Scenario: List is refused

- **WHEN** a client sends `{"name":"list","args":{}}` to the extension socket
- **THEN** the response line has a non-empty `error.message`
- **AND** `variant-api` list does not run

#### Scenario: Implode is refused

- **WHEN** a client sends `{"name":"implode","args":{"slug":"test-feature"}}` to the extension socket
- **THEN** the response line has a non-empty `error.message`
- **AND** `variant-api` implode does not run

#### Scenario: Watch is refused

- **WHEN** a client sends `{"name":"watch","args":{}}` to the extension socket
- **THEN** the response line has a non-empty `error.message`
- **AND** `variant-api` watch does not run

#### Scenario: View actions do not use the socket

- **WHEN** a person presses play on a variant in the Variants view
- **THEN** the extension runs the watch in-process and the socket is not involved
- **AND** a socket request named `watch` still fails

### Requirement: Deactivation removes sockets this activation bound

When the extension deactivates, it SHALL remove each socket file bound during that activation. It SHALL leave a socket that this activation failed to bind because another listener already owns it.

#### Scenario: Deactivate unlinks the socket

- **WHEN** the extension activated for `/work/vw/variant-worktrees` and then deactivates
- **THEN** `/work/vw/variant-worktrees/.vscode/variant-worktrees.sock` is gone

#### Scenario: Live foreign socket survives deactivation

- **WHEN** another listener already owns `/work/.vscode/variant-worktrees.sock`, this activation does not take it over, and the extension then deactivates
- **THEN** that socket file remains and still accepts connections

### Requirement: Log request writes the channel

A socket request named `log` SHALL NOT be refused as a lifecycle command or as an unsupported editor request. `args.level` SHALL be `trace`, `debug`, `info`, `warn`, or `error`, and `args.message` SHALL be a string. The extension SHALL write that event to the Variant Worktrees log channel at that level, using the same channel text as an in-process event with that message, step, and slug. When `args.origin` is `cli` or `mcp`, the channel text SHALL end with ` @cli` or ` @mcp`. Any other origin SHALL be ignored and SHALL add no suffix. The channel text SHALL NOT contain `cmd=`, ` [cli]`, or ` [mcp]`. The response SHALL NOT have an error. `step`, `slug`, and `origin` MAY be omitted. A request whose level or message is missing or invalid SHALL respond with a non-empty `error.message` and SHALL NOT write a channel line for that request.

#### Scenario: Info event is written

- **WHEN** a client sends `{"name":"log","args":{"level":"info","message":"+\"mise install\"","step":"create","slug":"add-auth"}}` to the extension socket
- **THEN** the Variant Worktrees channel receives that event at info as `<add-auth> [create] +"mise install"`
- **AND** the line does not contain `cmd=`
- **AND** the response line has no `error`

#### Scenario: CLI and MCP origins are marked

- **WHEN** a client sends a log request whose origin is `cli` or `mcp` and whose message is `ready`
- **THEN** the channel line is `ready @cli` or `ready @mcp`
- **AND** the line does not end with ` [cli]` or ` [mcp]`

#### Scenario: Invalid log is refused

- **WHEN** a client sends `{"name":"log","args":{}}` to the extension socket
- **THEN** the response line has a non-empty `error.message`
- **AND** the Variant Worktrees channel gains no line for that request

### Requirement: Activation lists the long version

The first info line on the Variant Worktrees channel SHALL still be `activating variant-worktrees (<host> <editor version>)`. The next info entry SHALL be the same long text `variant --version` prints on a terminal: the version token, the parenthetical, the cursive banner, a blank line, and the platform and repository URL. That entry SHALL contain no ANSI color. A package version that already ends with the variant suffix SHALL NOT be suffixed twice.

#### Scenario: Activation log

- **WHEN** the extension activates
- **THEN** the first info line is `activating variant-worktrees (Cursor <editor version>)`
- **AND** the next info entry starts with the package version, contains the cursive drawing and the GitHub URL, and contains no ANSI escape
