## MODIFIED Requirements

### Requirement: Create schema variant

The system SHALL create the git worktree and the state for a slug. It SHALL NOT create a database schema or database file. That is the `provision` step. It SHALL write `.cache/variant/state.yaml` in the variant directory: the worktree `<prefix><slug>`, or the main checkout when the slug is `main`. That file SHALL contain `createdAt` set to the local time the create runs, formatted `YYYY-MM-DD_HH:MM:SS` (zero-padded date, underscore, zero-padded 24-hour time, no timezone suffix), plus `slug`, `dir`, `dialect` and `target`. When `createdAt` is already present, create SHALL leave it unchanged. The system SHALL NOT write `variants.local.yaml` or `.cache/variants/<slug>.yaml`.

#### Scenario: Create PostgreSQL schema variant

- **WHEN** the client calls `create("test-feature")` with a PostgreSQL connection
- **THEN** no schema is created, the worktree exists, and state is written to `<worktree>/.cache/variant/state.yaml`

#### Scenario: Create SQLite variant

- **WHEN** the client calls `create("test-feature")` with a SQLite connection string
- **THEN** no database file is created and the state is persisted

#### Scenario: Idempotent create

- **WHEN** a variant already exists and `create()` is called
- **THEN** the call succeeds without changing existing state

#### Scenario: Local created time

- **WHEN** `create("demo")` runs at 12:22:05 local time on 2026-11-04
- **THEN** the variant directory's `.cache/variant/state.yaml` contains `createdAt: 2026-11-04_12:22:05`

#### Scenario: Created time kept

- **WHEN** `state.yaml` already has `createdAt: 2026-01-02_03:04:05` and `create` runs again
- **THEN** `createdAt` is still `2026-01-02_03:04:05`

### Requirement: List variants

The system SHALL return an inventory of known variants from `.cache/variant/state.yaml` files, the database, and the legacy read of `variants.local.yaml` and `.cache/variants/<slug>.yaml` described by the local-runtime requirement, merged by slug. The state files SHALL be harvested from the main checkout and from every `<prefix>*` worktree below the variant root. Each record SHALL carry, when known, the worktree directory, the runtime `mode`, the URL of the first watch that has one, the database target, and for every watch its `port`, `pid`, `url` and whether the pid is alive. A value from several sources SHALL be taken from the state file first, then a legacy file, then the database. A state file that cannot be read SHALL NOT fail the call.

Each record that has a directory SHALL carry `changedMs`, epoch milliseconds: the later modification time of that directory and of its `.cache/variant/state.yaml`, skipping a path that does not exist. It SHALL carry `createdMs`, epoch milliseconds. When `createdAt` matches `YYYY-MM-DD_HH:MM:SS`, `createdMs` SHALL be that timestamp read as local time. When `createdAt` is missing or ill-formed, or the state file cannot be read, `createdMs` SHALL be that directory's creation time. A record with no directory SHALL omit both.

Each record SHALL carry `implodeClean`. It SHALL be false for `main`. For every other variant it SHALL be true exactly when `implode` of that slug without `force` would succeed. Where that command would remove a git worktree, files it deletes before the removal SHALL NOT count as dirt: untracked files matching `variant.implode.untracked`, untracked files inside a `preRm` directory, and tracked modifications whose base name is in `variant.implode.restore`. A tracked file inside a `preRm` directory SHALL count as dirt unless `restore` would put it back. Ignored files SHALL NOT count as dirt. A variant whose worktree git would not remove SHALL be clean. Deciding this SHALL NOT delete or modify anything.

#### Scenario: List all variants

- **WHEN** the client calls `list()`
- **THEN** the result includes slug, schema or database, and state path for each variant

#### Scenario: Empty list

- **WHEN** no `.cache/variant/state.yaml` exists under the variant root or the main checkout and no `v_*` schemas exist
- **THEN** the result is an empty array

#### Scenario: Runtime facts merged

- **WHEN** worktree `_v-demo` has a `.cache/variant/state.yaml` with `slug: demo`, `mode: watch` and `watches.fe.url`
- **THEN** the record for `demo` carries that mode, URL and its directory

#### Scenario: Live process

- **WHEN** a state file records a pid that is running and another that is not
- **THEN** the first watch is reported alive and the second not alive

#### Scenario: Database-only variant

- **WHEN** the database holds schema `v_orphan` and no state file mentions it
- **THEN** the result includes slug `orphan` with its target and no directory, mode or URL

#### Scenario: Unreadable state file

- **WHEN** one `state.yaml` is invalid
- **THEN** the call succeeds and the other variants are listed

#### Scenario: Unreadable runtime file

- **WHEN** one `state.yaml` is invalid
- **THEN** the call succeeds and the other variants are listed

#### Scenario: Created and changed times

- **WHEN** `createdAt` is `2026-03-01_09:30:00` and `state.yaml` is modified after that moment
- **THEN** `createdMs` is 2026-03-01 09:30:00 local time as epoch milliseconds and `changedMs` is the file's modification time

#### Scenario: No state file

- **WHEN** a variant has a directory and no `.cache/variant/state.yaml` and no legacy file
- **THEN** `createdMs` is that directory's creation time and `changedMs` is its modification time

#### Scenario: No local file

- **WHEN** a variant has a directory and no `.cache/variant/state.yaml` and no legacy file
- **THEN** `createdMs` is that directory's creation time and `changedMs` is its modification time

#### Scenario: Ill-formed created time

- **WHEN** `createdAt` is `yesterday` and the variant directory has a creation time
- **THEN** the record is still listed and `createdMs` is that directory's creation time

#### Scenario: Clean worktree

- **WHEN** variant `demo` is merged and its worktree has no dirt implode would keep
- **THEN** its record has `implodeClean` true

#### Scenario: Unmerged work

- **WHEN** variant `demo` has a commit that is not in the base branch and `requireMerged` is not false
- **THEN** its record has `implodeClean` false and nothing was deleted

#### Scenario: Pre-removal directory

- **WHEN** the only untracked file sits inside a `preRm` directory
- **THEN** `implodeClean` is true

#### Scenario: Restored lockfile

- **WHEN** the only tracked modification is a file whose base name is in `restore`
- **THEN** `implodeClean` is true

#### Scenario: Modified source

- **WHEN** a tracked source file is modified and is not listed in `restore`
- **THEN** `implodeClean` is false

#### Scenario: Main is not clean

- **WHEN** the record is `main`
- **THEN** `implodeClean` is false

#### Scenario: Legacy state still listed

- **WHEN** `_v-demo` has no `.cache/variant/state.yaml` and has `variants.local.yaml` with `runtime.slug: demo`
- **THEN** the record for `demo` is listed

### Requirement: State persistence

The system SHALL persist variant metadata in `<variant>/.cache/variant/state.yaml` using a yq-compatible format. `<variant>` is the worktree directory, or the main checkout when the slug is `main`. The system SHALL NOT persist that metadata in `.cache/variants/<slug>.yaml`.

#### Scenario: Write state on create
- **WHEN** a variant is created
- **THEN** `state.yaml` contains slug, schema or database, creation timestamp, and worktree path

#### Scenario: Legacy JSON is not the write path
- **WHEN** a variant is created and `.cache/variants/<slug>.json` exists elsewhere
- **THEN** the created state is still `<variant>/.cache/variant/state.yaml`

#### Scenario: State migration from JSON
- **WHEN** `.cache/variants/<slug>.json` exists
- **THEN** it is converted to `.cache/variants/<slug>.yaml` and the JSON file is removed
- **AND** the operational state of a new variant is still `<variant>/.cache/variant/state.yaml`

### Requirement: Implode variant

The system SHALL implode a variant: stop its runtime (as `down` does), drop the variant schema or remove its database file, delete its storage directory, clear its state including `.cache/variant/state.yaml` and `.cache/variant/runtime.yaml`, and remove its git worktree. The merge gate, cleanup and report of the worktree removal are specified by the implode capability. The former `destroy` command and `destroy()` client method SHALL NOT exist.

#### Scenario: Implode PostgreSQL variant
- **WHEN** the client calls `implode("test-feature")` with PostgreSQL for a variant that has no worktree
- **THEN** schema `v_test_feature` is dropped and that variant's `.cache/variant/state.yaml` is removed when it exists

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
- **WHEN** `test-feature` has `.cache/variant/state.yaml` and `.cache/variant/runtime.yaml`
- **THEN** implode removes both files before the worktree is removed

#### Scenario: Destroy is gone
- **WHEN** a user runs `variant destroy`
- **THEN** the CLI reports an unknown command
