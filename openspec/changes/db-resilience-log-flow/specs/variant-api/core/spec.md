## ADDED Requirements

### Requirement: List while the database cannot be contacted

When the configured database cannot be contacted, `list` SHALL succeed. It SHALL return every variant known from a `.cache/variant/state.yaml` or from a worktree directory, and SHALL omit variants known only as database schemas. It SHALL emit the database contact warning once. It SHALL NOT fail the call.

#### Scenario: Worktree listed, schema omitted

- **WHEN** worktree `_v-demo` has a state file for `demo`, the database holds schema `v_orphan` with no state file, and the database cannot be contacted
- **THEN** `list` returns `demo` and does not return `orphan`
- **AND** the contact warning is emitted once

#### Scenario: Nothing on disk

- **WHEN** no state file and no worktree exist and the database cannot be contacted
- **THEN** `list` returns an empty array and emits the contact warning

### Requirement: Mutations fail closed when the database cannot be contacted

A command that creates, drops, or migrates a database schema SHALL fail when the configured database cannot be contacted. The failure text SHALL be the database contact warning. The process SHALL exit non-zero. The text SHALL NOT contain a SQL statement or `Failed query`.

#### Scenario: Create fails closed

- **WHEN** the configured database cannot be contacted and a user runs `variant create demo`
- **THEN** the command fails, standard error contains the contact warning, standard error does not contain `SELECT`, and the process exits non-zero

### Requirement: Other database failures hide the statement

When a database command fails for a reason other than the database being unreachable, the text a person sees on standard error SHALL NOT contain the SQL statement or `Failed query`. The statement SHALL be logged at debug.

#### Scenario: Statement is not the user text

- **WHEN** a database command fails and the driver message contains `Failed query` and a `SELECT` statement
- **THEN** standard error does not contain `Failed query` or that statement
- **AND** a debug log event contains the statement
