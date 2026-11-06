# variant-mcp/logging Specification

## Purpose

Sends the variant log stream to an MCP client as logging notifications, and keeps a database contact failure out of the raw query text of a tool result.

## Requirements

### Requirement: Logging notifications

The MCP server SHALL accept `logging/setLevel` and SHALL send each library log event at or above the selected level as a logging notification. Until the client sets a level, the threshold SHALL be warning. Library `warn` SHALL be sent as MCP level `warning`, `error` as `error`, `info` as `info`, and `debug` as `debug`. Library `trace` SHALL be sent as MCP level `debug` with the library level trace identifiable in the notification data, and only when the client level is `debug`. A logging notification SHALL NOT be written as the tool result text.

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

### Requirement: Tool results and a contact failure

`variant_list` and `variant_status` of a variant known from its state file or worktree SHALL return success when the configured database cannot be contacted, and the result text SHALL be the command result and SHALL NOT contain `Failed query` or a SQL statement. A tool whose command creates, drops, or migrates a database schema SHALL return an error when the database cannot be contacted, and that error text SHALL be the contact warning and SHALL NOT contain a SQL statement.

#### Scenario: List stays successful

- **WHEN** an MCP client calls `variant_list` and the configured database cannot be contacted
- **THEN** the tool result is not an error, its text does not contain `SELECT`, and a warning logging notification carries the contact warning when the level allows it

#### Scenario: Create is an error

- **WHEN** an MCP client calls `variant_create` for slug `demo` and the configured database cannot be contacted
- **THEN** the tool result is an error whose text is the contact warning and does not contain `SELECT`
