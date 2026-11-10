## MODIFIED Requirements

### Requirement: Database contact warning

When a configured PostgreSQL or MySQL database cannot be contacted, the library SHALL emit one event for that failure. The level SHALL be `warn`, unless the known-temporary-directory rule selects a directory that matches, in which case the level SHALL be `trace`. The message SHALL include the dialect, the database name, the host, and the port that were used. It SHALL NOT include a password, a password from a connection URL, the text `Failed query`, or a SQL statement. The same failure repeated while handling one command SHALL emit that warning once. A missing SQLite file SHALL NOT emit this warning. Connection refused, a timeout, an unknown host, authentication failure, and a missing database of that name SHALL count as cannot be contacted. A later statement error after a successful connection SHALL NOT.

#### Scenario: Postgres refused

- **WHEN** the configured database is PostgreSQL, named `app`, at host `127.0.0.1` and port `5432`, and the connection is refused, and the selected directory is not a known temporary directory
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

- **WHEN** one list consults the schema catalog more than once and each attempt cannot contact the database, and the selected directory is not a known temporary directory
- **THEN** one warn event is emitted

#### Scenario: Temporary directory emits trace

- **WHEN** the selected directory is `/tmp/variant-app` and the database cannot be contacted
- **THEN** one event at `trace` carries the contact warning
- **AND** no `warn` event is emitted for that failure

### Requirement: Statement at debug only

A SQL statement associated with a database failure SHALL be logged at `debug` when the directory selected by the known-temporary-directory rule does not match, and at `trace` when it does. The statement SHALL NOT appear in a `warn` or `error` message.

#### Scenario: Debug holds the statement

- **WHEN** a database query fails and the selected directory is not a known temporary directory
- **THEN** a debug event contains the statement and the warn or error message does not contain it

#### Scenario: Temporary directory holds the statement at trace

- **WHEN** a database query fails and the selected directory is `/tmp/variant-app`
- **THEN** a trace event contains the statement and no debug event contains it

## ADDED Requirements

### Requirement: Known temporary directory forces trace

The known temporary directories SHALL be `/tmp`, `/private/tmp`, `/var/folders`, `/var/tmp`, and the process temporary directory. A directory matches when it is one of those directories or a directory inside one. The comparison SHALL use the path as given and the path after symbolic links are resolved, so a link at `/tmp` covers the directory it points at.

The directory the rule selects SHALL be the project directory of the event's variant when the event has a slug, and the process working directory when the event has no slug.

When the selected directory matches, the library SHALL emit that event at `trace` and SHALL NOT emit it at `debug`, `info`, `warn`, or `error`. The message, the step, and the slug SHALL stay as the call site set them. When the selected directory does not match, the level SHALL stay the level the call site requested. This rule SHALL apply to every library event for that directory, including a contact warning, a statement log, a shell-command line, and an implode finish or branch event.

#### Scenario: Provision under /tmp is trace

- **WHEN** provisioning variant `test-feature` whose project directory is `/tmp/variant-mcp-test` logs schema creation
- **THEN** the event is `trace`, the step is `provision`, the slug is `test-feature`, and the message names the schema
- **AND** no info event is emitted for that schema creation

#### Scenario: Same line outside the known directories stays info

- **WHEN** provisioning variant `demo` whose project directory is `/work/demo` logs schema creation
- **THEN** the event is `info`

#### Scenario: User and process temporary directories match

- **WHEN** the variant project directory is `/var/folders/ab/cd`, `/var/tmp/variant-app`, or the process temporary directory
- **THEN** the event is `trace`

#### Scenario: A link at /tmp matches

- **WHEN** `/tmp` is a symbolic link and the variant project directory is a directory inside the target of that link
- **THEN** the event is `trace`

#### Scenario: Working directory quiets a slug-less event

- **WHEN** the library emits an event with no slug while the process working directory is `/tmp/variant-test`
- **THEN** that event is `trace`

### Requirement: Listing is not logged

`list` SHALL NOT emit a log event whose message is `list`, `listing variants`, or `listed variants`. It SHALL NOT emit any other event whose only purpose is to say that listing started or finished. This SHALL hold when `quiet` is omitted and when a subscription lists again. A contact warning during list SHALL still follow the contact-warning requirement.

#### Scenario: List is silent

- **WHEN** `list()` runs and a host is receiving events
- **THEN** no event has message `list`, `listing variants`, or `listed variants`

#### Scenario: A second list stays silent

- **WHEN** a subscription lists, then lists again
- **THEN** neither read emits those messages

### Requirement: Shell command message

A shell command on the log stream SHALL use the message `+"<command>"`: a plus, then the command in double quotes, with no space between the plus and the quote. A double quote or a backslash in the command SHALL be escaped. This SHALL cover the seed command, a provisioning step that runs a shell command, `mise trust --all`, and `mise install`. A schema line `create schema <name>` SHALL NOT use this form. The message SHALL NOT contain `cmd=`. The progress-log echo `+ <command>` SHALL stay unchanged.

#### Scenario: Seed

- **WHEN** the seed command is `printf seeded` for variant `test-feature`
- **THEN** one event has step `seed`, slug `test-feature`, and message `+"printf seeded"`
- **AND** the message does not contain `cmd=`

#### Scenario: Mise

- **WHEN** `mise trust --all` and `mise install` are logged for step `watch`
- **THEN** the messages are `+"mise trust --all"` and `+"mise install"`
- **AND** neither message contains `cmd=`

#### Scenario: Schema line stays plain

- **WHEN** provisioning logs creation of schema `v_demo`
- **THEN** the message is `create schema v_demo` and does not start with `+`

#### Scenario: Quote inside the command

- **WHEN** the seed command is `echo "hi"`
- **THEN** the message is `+"echo \"hi\""`
