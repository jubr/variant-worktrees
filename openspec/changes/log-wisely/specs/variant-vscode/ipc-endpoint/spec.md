## MODIFIED Requirements

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
