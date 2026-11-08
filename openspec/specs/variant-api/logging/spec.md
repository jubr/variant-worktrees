# variant-api/logging Specification

## Purpose

One leveled log stream for variant operations, shared by the CLI, the MCP server, and the editor, including the warning when the configured database cannot be contacted.

## Requirements

### Requirement: Log levels

The library SHALL emit log events at `trace`, `debug`, `info`, `warn`, and `error` through the shared log stream. An event MAY include a step and a slug as fields. The message SHALL NOT repeat that step or that slug inside brackets. A host SHALL be able to receive each event. Emitting an event with no host attached SHALL NOT throw and SHALL NOT write that event to standard output.

#### Scenario: Silent without a host

- **WHEN** the library logs a warning and no host is receiving events
- **THEN** standard output is unchanged and the call does not throw

#### Scenario: Provision names the step

- **WHEN** provisioning variant `demo` logs the schema creation for operation `provision`
- **THEN** the event step is `provision`, the slug is `demo`, and the message does not contain `[demo]` or `[provision]`

### Requirement: Database contact warning

When a configured PostgreSQL or MySQL database cannot be contacted, the library SHALL emit one `warn` event for that failure. The message SHALL include the dialect, the database name, the host, and the port that were used. It SHALL NOT include a password, a password from a connection URL, the text `Failed query`, or a SQL statement. The same failure repeated while handling one command SHALL emit that warning once. A missing SQLite file SHALL NOT emit this warning. Connection refused, a timeout, an unknown host, authentication failure, and a missing database of that name SHALL count as cannot be contacted. A later statement error after a successful connection SHALL NOT.

#### Scenario: Postgres refused

- **WHEN** the configured database is PostgreSQL, named `app`, at host `127.0.0.1` and port `5432`, and the connection is refused
- **THEN** one warn event's message contains `postgres`, `app`, `127.0.0.1`, and `5432`
- **AND** the message contains neither the password nor `SELECT`

#### Scenario: URL password stays out

- **WHEN** the connection is given as a URL whose userinfo contains a password and the database cannot be contacted
- **THEN** the warning message does not contain that password

#### Scenario: Unknown database

- **WHEN** the server answers that the configured database name does not exist
- **THEN** the library emits the contact warning and does not treat the failure as a statement error

#### Scenario: SQLite file not created yet

- **WHEN** the configured database is SQLite and its file does not exist
- **THEN** listing variants succeeds and no contact warning is emitted

#### Scenario: Once per command

- **WHEN** one list consults the schema catalog more than once and each attempt cannot contact the database
- **THEN** one warn event is emitted

### Requirement: Statement at debug only

A SQL statement associated with a database failure SHALL be logged at `debug` and SHALL NOT appear in a `warn` or `error` message.

#### Scenario: Debug holds the statement

- **WHEN** a database query fails
- **THEN** a debug event contains the statement and the warn or error message does not contain it
