## MODIFIED Requirements

### Requirement: Logging notifications

The MCP server SHALL accept `logging/setLevel` and SHALL send each log event at or above the selected level as a logging notification. Until the client sets a level, the threshold SHALL be warning. Library `warn` SHALL be sent as MCP level `warning`, `error` as `error`, `info` as `info`, and `debug` as `debug`. Library `trace` SHALL be sent as MCP level `debug` with the library level trace identifiable in the notification data, and only when the client level is `debug`. The notification data SHALL be an object with `message`, plus `step` when the event has a step, plus `slug` when the event has a slug. A trace event's data SHALL also identify the library level as `trace`. A logging notification SHALL NOT be written as the tool result text. Each library event SHALL also be sent to the editor socket as a `log` request whose `args.origin` is `mcp`. The notification data SHALL NOT contain ` [mcp]`. A failed connect SHALL NOT fail the tool. A single write SHALL NOT wait longer than 1 second; after that the socket SHALL stay dropped for the rest of the process.

#### Scenario: Editor socket is marked mcp

- **WHEN** a tool call emits an info event `listed variants` and the editor socket is listening
- **THEN** the socket receives a `log` request whose args include origin `mcp`
- **AND** no logging notification data contains ` [mcp]`

#### Scenario: Default is warning

- **WHEN** the server handles a tool call that emits a warn event and an info event and the client has not set a level
- **THEN** the client receives a logging notification at `warning` for the warn event and none for the info event

#### Scenario: Client asks for info

- **WHEN** the client has set the level to `info` and a tool call emits info, warn, and debug events
- **THEN** the client receives notifications for the info and warn events and none for the debug event

#### Scenario: Trace rides on debug

- **WHEN** the client has set the level to `debug` and a tool call emits a trace event
- **THEN** the client receives a logging notification at `debug` whose data identifies the library level as trace

#### Scenario: Error threshold

- **WHEN** the client has set the level to `error` and a tool call emits a warn event
- **THEN** the client receives no logging notification for that warn event

#### Scenario: Step travels in the data

- **WHEN** the client has set the level to `info` and a tool call emits an info event with step `create` and message `+ mise install`
- **THEN** the notification data includes that message and step `create`
