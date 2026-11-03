## MODIFIED Requirements

### Requirement: Create schema variant

The system SHALL create an isolated database schema or database file for a slug, unless `variant.steps` contains a step named `provision`. When it does, `create` SHALL create the worktree and the state only, and the schema SHALL be left to that step. The worktree part of `create` is unchanged either way.

#### Scenario: Create PostgreSQL schema variant
- **WHEN** the client calls `create("test-feature")` with a PostgreSQL connection and no step is named `provision`
- **THEN** schema `v_test_feature` is created and state is written to `.cache/variants/test-feature.yaml`

#### Scenario: Create SQLite variant
- **WHEN** the client calls `create("test-feature")` with a SQLite connection string and no step is named `provision`
- **THEN** file `.cache/variants/test-feature.db` is created and state is persisted

#### Scenario: Idempotent create
- **WHEN** a variant already exists and `create()` is called
- **THEN** the call succeeds without changing existing state

#### Scenario: Provision step owns the schema
- **WHEN** `variant.steps` contains a step named `provision` and the client calls `create("test-feature")` with a PostgreSQL connection
- **THEN** no schema is created, and the worktree and the state file exist
