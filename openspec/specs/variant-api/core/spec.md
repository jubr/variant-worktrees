# variant-api core Specification

## Purpose

The core API manages isolated database variants, git worktrees, slugs, and
portable YAML state across supported database engines.

## Requirements

### Requirement: Create schema variant

The system SHALL create an isolated database schema or database file for a slug.

#### Scenario: Create PostgreSQL schema variant
- **WHEN** the client calls `create("test-feature")` with a PostgreSQL connection
- **THEN** schema `v_test_feature` is created and state is written to `.cache/variants/test-feature.yaml`

#### Scenario: Create SQLite variant
- **WHEN** the client calls `create("test-feature")` with a SQLite connection string
- **THEN** file `.cache/variants/test-feature.db` is created and state is persisted

#### Scenario: Idempotent create
- **WHEN** a variant already exists and `create()` is called
- **THEN** the call succeeds without changing existing state

### Requirement: Destroy schema variant

The system SHALL drop a variant schema or remove its database file and clear state.

#### Scenario: Destroy PostgreSQL variant
- **WHEN** the client calls `destroy("test-feature")` with PostgreSQL
- **THEN** schema `v_test_feature` is dropped and `.cache/variants/test-feature.yaml` is removed

#### Scenario: Main schema protection
- **WHEN** the slug resolves to `main`, representing the primary worktree
- **THEN** destroy throws an error and refuses to drop a non-`v_*` schema

#### Scenario: Missing variant
- **WHEN** `destroy("nonexistent")` is called
- **THEN** the call succeeds without changes

### Requirement: List variants

The system SHALL return an inventory of known variants from state and the database.

#### Scenario: List all variants
- **WHEN** the client calls `list()`
- **THEN** the result includes slug, schema or database, and state path for each variant

#### Scenario: Empty list
- **WHEN** `.cache/variants/` is empty and no `v_*` schemas exist
- **THEN** the result is an empty array

### Requirement: Slug resolution

The system SHALL derive a slug from the git worktree or branch, or accept an explicit `-s/--slug` value.

#### Scenario: Primary worktree slug
- **WHEN** the current directory is the primary git worktree
- **THEN** the slug resolves to `main`

#### Scenario: Feature worktree slug
- **WHEN** the current directory is a worktree on branch `feat/add-auth`
- **THEN** the slug resolves to `add-auth`

#### Scenario: Explicit slug override
- **WHEN** the CLI receives `--slug preview-one`
- **THEN** the slug is `preview-one` and git detection is skipped

#### Scenario: No git repository
- **WHEN** the current directory is not a git worktree and no `--slug` value is provided
- **THEN** the system returns an error with a usage hint

### Requirement: Multi-DB strategy

The system SHALL use schema-per-variant for PostgreSQL and MySQL, database-per-variant for SQLite, and report unsupported dialects.

#### Scenario: PostgreSQL uses schemas
- **WHEN** the connection is PostgreSQL
- **THEN** create and destroy operate on `v_<slug>` schemas

#### Scenario: SQLite uses database files
- **WHEN** the connection is SQLite
- **THEN** each variant is stored in `.cache/variants/<slug>.db`

#### Scenario: Unsupported dialect
- **WHEN** the dialect lacks supported schema or database isolation
- **THEN** the system returns an error explaining that table-prefix mode is not implemented

### Requirement: Worktree coupling

The system SHALL create or switch to `_v-<slug>` worktrees below the resolved `variant.root` when variant operations require it.

#### Scenario: Ensure worktree on create
- **WHEN** `create("add-auth")` is called from the primary worktree
- **THEN** `_v-add-auth` is created on `feat/add-auth` below the resolved root and the process switches to it

#### Scenario: Main slug stays in primary
- **WHEN** the slug resolves to `main`
- **THEN** no worktree is created and the process stays in the primary checkout

#### Scenario: Worktree uses resolved variant root
- **WHEN** `create("add-auth")` requires a worktree and `variant.root` resolves to `/workspace`
- **THEN** the worktree path is `/workspace/_v-add-auth`

### Requirement: State persistence

The system SHALL persist variant metadata in `.cache/variants/<slug>.yaml` using a yq-compatible format.

#### Scenario: Write state on create
- **WHEN** a variant is created
- **THEN** YAML contains slug, schema or database, creation timestamp, and worktree path

#### Scenario: State migration from JSON
- **WHEN** `.cache/variants/<slug>.json` exists
- **THEN** it is converted to YAML and the JSON file is removed

### Requirement: Worktree prefix

The system SHALL name worktree directories `<prefix><slug>` using the resolved `variant.prefix`, which defaults to `_v-` and already holds its connector.

#### Scenario: Default prefix

- **WHEN** `create("add-auth")` requires a worktree and no prefix is configured
- **THEN** the worktree directory is named `_v-add-auth`

#### Scenario: Configured prefix

- **WHEN** `variant.prefix` is `_work-` and `create("add-auth")` requires a worktree
- **THEN** the worktree directory is named `_work-add-auth`

### Requirement: Instance commands run in the instance directory

The system SHALL run the `up` command of an entry of `variant.instances` during provisioning with the instance's `dir`, resolved against the variant's worktree, as its working directory. The variant-wide `up` command used when no instances exist, and the seed command, SHALL run in the worktree root.

#### Scenario: Instance command runs in its directory

- **WHEN** an instance with `dir: be` and `up: pwd` is provisioned in a worktree `/w`
- **THEN** the command runs in `/w/be`

#### Scenario: Seed runs in the worktree root

- **WHEN** a variant with instances and a seed command is provisioned
- **THEN** the seed command runs in the worktree root
