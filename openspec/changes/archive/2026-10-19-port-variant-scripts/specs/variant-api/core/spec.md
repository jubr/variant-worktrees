## ADDED Requirements

### Requirement: Implode variant

The system SHALL implode a variant: stop its runtime (as `down` does), drop the variant schema or remove its database file, delete its storage directory, clear its state including the `runtime` section of its `variants.local.yaml`, and remove its git worktree. The merge gate, cleanup and report of the worktree removal are specified by the implode capability. The former `destroy` command and `destroy()` client method SHALL NOT exist.

#### Scenario: Implode PostgreSQL variant
- **WHEN** the client calls `implode("test-feature")` with PostgreSQL for a variant that has no worktree
- **THEN** schema `v_test_feature` is dropped and `.cache/variants/test-feature.yaml` is removed

#### Scenario: Main schema protection
- **WHEN** the slug resolves to `main`, representing the primary worktree
- **THEN** implode throws an error and refuses to drop a non-`v_*` schema

#### Scenario: Missing variant
- **WHEN** `implode("nonexistent")` is called
- **THEN** the call succeeds without changes

#### Scenario: Runtime stopped first
- **WHEN** variant `test-feature` has a detached watch and `implode("test-feature")` is called
- **THEN** the recorded processes are terminated before its schema is dropped

#### Scenario: Storage removed
- **WHEN** `variant.storage` is configured and `test-feature` has files in its storage directory
- **THEN** implode deletes the storage directory

#### Scenario: Runtime state cleared
- **WHEN** `test-feature` has a `runtime` section in its worktree's `variants.local.yaml`
- **THEN** implode removes that section before the worktree is removed

#### Scenario: Destroy is gone
- **WHEN** a user runs `variant destroy`
- **THEN** the CLI reports an unknown command

## MODIFIED Requirements

### Requirement: Multi-DB strategy

The system SHALL use schema-per-variant for PostgreSQL and MySQL, database-per-variant for SQLite, and report unsupported dialects.

#### Scenario: PostgreSQL uses schemas
- **WHEN** the connection is PostgreSQL
- **THEN** create and implode operate on `v_<slug>` schemas

#### Scenario: SQLite uses database files
- **WHEN** the connection is SQLite
- **THEN** each variant is stored in `.cache/variants/<slug>.db`

#### Scenario: Unsupported dialect
- **WHEN** the dialect lacks supported schema or database isolation
- **THEN** the system returns an error explaining that table-prefix mode is not implemented

### Requirement: List variants

The system SHALL return an inventory of known variants from state files, the database, and the `runtime` sections of the `variants.local.yaml` files of the main checkout and of every `<prefix>*` worktree below the variant root, merged by slug. Each record SHALL carry, when known, the worktree directory, the runtime `mode`, the URL of the first instance that has one, the database target, and for every instance its `port`, `pid`, `url` and whether the pid is alive. A value from several sources SHALL be taken from state first, then runtime, then the database. A runtime file that cannot be read SHALL NOT fail the call.

#### Scenario: List all variants
- **WHEN** the client calls `list()`
- **THEN** the result includes slug, schema or database, and state path for each variant

#### Scenario: Empty list
- **WHEN** `.cache/variants/` is empty and no `v_*` schemas exist
- **THEN** the result is an empty array

#### Scenario: Runtime facts merged
- **WHEN** worktree `_v-demo` has a `variants.local.yaml` with `runtime.slug: demo`, `mode: watch` and `instances.fe.url`
- **THEN** the record for `demo` carries that mode, URL and its directory

#### Scenario: Live process
- **WHEN** a runtime file records a pid that is running and another that is not
- **THEN** the first instance is reported alive and the second not alive

#### Scenario: Database-only variant
- **WHEN** the database holds schema `v_orphan` and no state or runtime file mentions it
- **THEN** the result includes slug `orphan` with its target and no directory, mode or URL

#### Scenario: Unreadable runtime file
- **WHEN** one `variants.local.yaml` is invalid
- **THEN** the call succeeds and the other variants are listed

### Requirement: Slug resolution

The system SHALL derive a slug from the git worktree or branch, or accept an explicit `-s/--slug` value. A branch name SHALL lose a leading `refs/heads/`, `feature/` and any of `variant.branchPrefixes` before it is lowered and reduced to `a-z0-9` words joined by `-`.

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

#### Scenario: Configured branch prefix
- **WHEN** `variant.branchPrefixes` is `["task/"]` and the worktree is on branch `task/add-auth`
- **THEN** the slug resolves to `add-auth`

### Requirement: Worktree coupling

The system SHALL create or switch to `_v-<slug>` worktrees below the resolved `variant.root` when variant operations require it. A new worktree SHALL start a branch named with the first of `variant.branchPrefixes` from `variant.baseBranch`, unless a branch named with any configured prefix already exists, which SHALL be checked out instead.

#### Scenario: Ensure worktree on create
- **WHEN** `create("add-auth")` is called from the primary worktree
- **THEN** `_v-add-auth` is created on `feat/add-auth` below the resolved root and the process switches to it

#### Scenario: Main slug stays in primary
- **WHEN** the slug resolves to `main`
- **THEN** no worktree is created and the process stays in the primary checkout

#### Scenario: Worktree uses resolved variant root
- **WHEN** `create("add-auth")` requires a worktree and `variant.root` resolves to `/workspace`
- **THEN** the worktree path is `/workspace/_v-add-auth`

#### Scenario: Configured base branch and prefix
- **WHEN** `variant.baseBranch` is `develop`, `variant.branchPrefixes` is `["task/"]` and `create("add-auth")` requires a worktree
- **THEN** branch `task/add-auth` is created from `develop`

#### Scenario: Existing branch with another configured prefix
- **WHEN** `variant.branchPrefixes` is `["feat/", "fix/"]` and branch `fix/add-auth` already exists
- **THEN** the worktree checks out `fix/add-auth`

## REMOVED Requirements

### Requirement: Destroy schema variant
**Reason**: Renamed to "Implode variant", which also stops runtimes, deletes storage and removes the worktree.
**Migration**: Use `implode` (`variant implode`, `client.implode()`) instead of `destroy`.
