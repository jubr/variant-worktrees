## Purpose

DB variant lifecycle (create/destroy/list schemas), multi-DB strategy, slug resolution, state persistence, and worktree coupling.

## ADDED Requirements

### Requirement: Create schema variant

The system SHALL create isolated database schema or database file for a slug.

#### Scenario: Create Postgres schema variant
- **WHEN** client calls `create("test-feature")` with Postgres connection
- **THEN** schema `v_test_feature` is created, state written to `.cache/variants/test-feature.yaml`

#### Scenario: Create SQLite variant
- **WHEN** client calls `create("test-feature")` with SQLite connection string
- **THEN** file `.cache/variants/test-feature.db` is created, state persisted

#### Scenario: Idempotent create
- **WHEN** variant already exists and `create()` is called
- **THEN** no-op success, existing state unchanged

### Requirement: Destroy schema variant

The system SHALL drop schema or remove database file and clear state.

#### Scenario: Destroy Postgres variant
- **WHEN** client calls `destroy("test-feature")` with Postgres
- **THEN** schema `v_test_feature` dropped, `.cache/variants/test-feature.yaml` removed

#### Scenario: Main schema protection
- **WHEN** slug resolves to `main` (primary worktree)
- **THEN** destroy throws error, refuses to drop non-`v_*` schema

#### Scenario: Missing variant
- **WHEN** `destroy("nonexistent")` is called
- **THEN** no-op success

### Requirement: List variants

The system SHALL return inventory of known variants from state and database.

#### Scenario: List all variants
- **WHEN** client calls `list()`
- **THEN** result includes slug, schema/database, state path for each variant

#### Scenario: Empty list
- **WHEN** `.cache/variants/` is empty and no `v_*` schemas exist
- **THEN** result is empty array

### Requirement: Slug resolution

The system SHALL derive slug from git worktree/branch or accept explicit `-s/--slug` flag.

#### Scenario: Primary worktree slug
- **WHEN** cwd is primary git worktree
- **THEN** slug resolves to `main`

#### Scenario: Feature worktree slug
- **WHEN** cwd is worktree on branch `feat/add-auth`
- **THEN** slug resolves to `add-auth`

#### Scenario: Explicit slug override
- **WHEN** CLI receives `--slug preview-one`
- **THEN** slug is `preview-one`, git detection skipped

#### Scenario: No git repo
- **WHEN** cwd is not a git worktree and no `--slug` flag
- **THEN** error with usage hint

### Requirement: Multi-DB strategy

The system SHALL choose schema-per-variant for Postgres/MySQL, database-per-variant for SQLite, table-prefix for unsupported dialects.

#### Scenario: Postgres uses schemas
- **WHEN** connection is Postgres
- **THEN** create/destroy operate on `v_<slug>` schemas

#### Scenario: SQLite uses database files
- **WHEN** connection is SQLite
- **THEN** each variant is `.cache/variants/<slug>.db`

#### Scenario: Unsupported dialect fallback
- **WHEN** dialect lacks schema support
- **THEN** error explaining table-prefix mode (future)

### Requirement: Worktree coupling

The system SHALL create/cd to `_v-<slug>` sibling worktree when variant ops require it.

#### Scenario: Ensure worktree on create
- **WHEN** `create("add-auth")` is called from primary worktree
- **THEN** `_v-add-auth` worktree created on `feat/add-auth` branch, cwd changed

#### Scenario: Slug main stays in primary
- **WHEN** slug resolves to `main`
- **THEN** no worktree creation, stay in primary checkout

### Requirement: State persistence

The system SHALL persist variant metadata in `.cache/variants/<slug>.yaml` using yq-compatible format.

#### Scenario: Write state on create
- **WHEN** variant created
- **THEN** YAML contains slug, schema/database, creation timestamp, worktree path

#### Scenario: State migration from JSON
- **WHEN** `.cache/variants/<slug>.json` exists
- **THEN** convert to YAML, remove JSON file
