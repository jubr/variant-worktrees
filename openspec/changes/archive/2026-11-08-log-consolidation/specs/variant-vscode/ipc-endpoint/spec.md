## ADDED Requirements

### Requirement: Log request writes the channel

A socket request named `log` SHALL NOT be refused as a lifecycle command or as an unsupported editor request. `args.level` SHALL be `trace`, `debug`, `info`, `warn`, or `error`, and `args.message` SHALL be a string. The extension SHALL write that event to the Variant Worktrees log channel at that level, using the same channel text as an in-process event with that message, step, and slug. When `args.origin` is `cli` or `mcp`, the channel text SHALL end with ` [cli]` or ` [mcp]`. Any other origin SHALL be ignored and SHALL add no suffix. The response SHALL NOT have an error. `step`, `slug`, and `origin` MAY be omitted. A request whose level or message is missing or invalid SHALL respond with a non-empty `error.message` and SHALL NOT write a channel line for that request.

#### Scenario: Info event is written

- **WHEN** a client sends `{"name":"log","args":{"level":"info","message":"+ mise install","step":"create","slug":"add-auth"}}` to the extension socket
- **THEN** the Variant Worktrees channel receives that event at info as `<add-auth> [create] cmd="mise install"`
- **AND** the response line has no `error`

#### Scenario: CLI and MCP origins are marked

- **WHEN** a client sends a log request whose origin is `cli` or `mcp` and whose message is `listed variants`
- **THEN** the channel line is `listed variants [cli]` or `listed variants [mcp]`

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
