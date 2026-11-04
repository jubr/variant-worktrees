## MODIFIED Requirements

### Requirement: Create schema variant

The system SHALL create the git worktree and the state for a slug. It SHALL NOT create a database schema or database file. That is the `provision` step.

#### Scenario: Create PostgreSQL schema variant

- **WHEN** the client calls `create("test-feature")` with a PostgreSQL connection
- **THEN** no schema is created, the worktree exists, and state is written to `.cache/variants/test-feature.yaml`

#### Scenario: Create SQLite variant

- **WHEN** the client calls `create("test-feature")` with a SQLite connection string
- **THEN** no database file is created and the state is persisted

#### Scenario: Idempotent create

- **WHEN** a variant already exists and `create()` is called
- **THEN** the call succeeds without changing existing state
