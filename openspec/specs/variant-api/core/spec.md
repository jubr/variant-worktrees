# variant-api core Specification

## Purpose

The core API manages isolated database variants, git worktrees, slugs, and
portable YAML state across supported database engines.

## Requirements

### Requirement: Create schema variant

The system SHALL create an isolated database schema or database file for a slug. It SHALL write `variants.local.yaml` in the variant directory: the worktree `<prefix><slug>`, or the main checkout when the slug is `main`. That file SHALL contain `runtime.createdAt` set to the local time the create runs, formatted `YYYY-MM-DD_HH:MM:SS` (zero-padded date, underscore, zero-padded 24-hour time, no timezone suffix). When `runtime.createdAt` is already present, create SHALL leave it unchanged. Other top-level keys of an existing file SHALL be kept.

#### Scenario: Create PostgreSQL schema variant
- **WHEN** the client calls `create("test-feature")` with a PostgreSQL connection
- **THEN** schema `v_test_feature` is created and state is written to `.cache/variants/test-feature.yaml`

#### Scenario: Create SQLite variant
- **WHEN** the client calls `create("test-feature")` with a SQLite connection string
- **THEN** file `.cache/variants/test-feature.db` is created and state is persisted

#### Scenario: Idempotent create
- **WHEN** a variant already exists and `create()` is called
- **THEN** the call succeeds without changing existing state

#### Scenario: Local created time

- **WHEN** `create("demo")` runs at 12:22:05 local time on 2026-11-04
- **THEN** the variant directory's `variants.local.yaml` contains `runtime.createdAt: 2026-11-04_12:22:05`

#### Scenario: Created time kept

- **WHEN** `variants.local.yaml` already has `runtime.createdAt: 2026-01-02_03:04:05` and `create` runs again
- **THEN** `runtime.createdAt` is still `2026-01-02_03:04:05`

### Requirement: List variants

The system SHALL return an inventory of known variants from state files, the database, and the `runtime` sections of the `variants.local.yaml` files of the main checkout and of every `<prefix>*` worktree below the variant root, merged by slug. Each record SHALL carry, when known, the worktree directory, the runtime `mode`, the URL of the first watch that has one, the database target, and for every watch its `port`, `pid`, `url` and whether the pid is alive. A value from several sources SHALL be taken from state first, then runtime, then the database. A runtime file that cannot be read SHALL NOT fail the call.

Each record that has a directory SHALL carry `changedMs`, epoch milliseconds: the later modification time of that directory and of its `variants.local.yaml`, skipping a path that does not exist. It SHALL carry `createdMs`, epoch milliseconds. When `runtime.createdAt` matches `YYYY-MM-DD_HH:MM:SS`, `createdMs` SHALL be that timestamp read as local time. When `createdAt` is missing or ill-formed, or the local file cannot be read, `createdMs` SHALL be that directory's creation time. A record with no directory SHALL omit both.

Each record SHALL carry `implodeClean`. It SHALL be false for `main`. For every other variant it SHALL be true exactly when `implode` of that slug without `force` would succeed. Where that command would remove a git worktree, files it deletes before the removal SHALL NOT count as dirt: untracked files matching `variant.implode.untracked`, untracked files inside a `preRm` directory, and tracked modifications whose base name is in `variant.implode.restore`. A tracked file inside a `preRm` directory SHALL count as dirt unless `restore` would put it back. Ignored files SHALL NOT count as dirt. A variant whose worktree git would not remove SHALL be clean. Deciding this SHALL NOT delete or modify anything.

#### Scenario: List all variants

- **WHEN** the client calls `list()`
- **THEN** the result includes slug, schema or database, and state path for each variant

#### Scenario: Empty list

- **WHEN** `.cache/variants/` is empty and no `v_*` schemas exist
- **THEN** the result is an empty array

#### Scenario: Runtime facts merged

- **WHEN** worktree `_v-demo` has a `variants.local.yaml` with `runtime.slug: demo`, `mode: watch` and `watches.fe.url`
- **THEN** the record for `demo` carries that mode, URL and its directory

#### Scenario: Live process

- **WHEN** a runtime file records a pid that is running and another that is not
- **THEN** the first watch is reported alive and the second not alive

#### Scenario: Database-only variant

- **WHEN** the database holds schema `v_orphan` and no state or runtime file mentions it
- **THEN** the result includes slug `orphan` with its target and no directory, mode or URL

#### Scenario: Unreadable runtime file

- **WHEN** one `variants.local.yaml` is invalid
- **THEN** the call succeeds and the other variants are listed

#### Scenario: Created and changed times

- **WHEN** `runtime.createdAt` is `2026-03-01_09:30:00` and `variants.local.yaml` is modified after that moment
- **THEN** `createdMs` is 2026-03-01 09:30:00 local time as epoch milliseconds and `changedMs` is the file's modification time

#### Scenario: No local file

- **WHEN** a variant has a directory and no `variants.local.yaml`
- **THEN** `createdMs` is that directory's creation time and `changedMs` is its modification time

#### Scenario: Ill-formed created time

- **WHEN** `runtime.createdAt` is `yesterday` and the variant directory has a creation time
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

### Requirement: Slug resolution

The system SHALL derive a slug from the git worktree or branch, or accept an explicit `-s/--slug` value. A branch name SHALL lose a leading `refs/heads/`, `feature/` and any of `variant.branchPrefixes` before it is lowered and reduced to `a-z0-9` words joined by `-`. An operation started in the primary checkout SHALL resolve to `main`. An operation started in a variant worktree SHALL resolve to that variant's slug. `${slug}` in a command of that operation SHALL expand to the same value. An operation started in the variant root SHALL NOT derive a slug from that directory. With an explicit slug, `create` and `watch` started there SHALL succeed.

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
- **WHEN** the current directory is not a git worktree, not the variant root, and no `--slug` value is provided
- **THEN** the system returns an error with a usage hint

#### Scenario: Configured branch prefix
- **WHEN** `variant.branchPrefixes` is `["task/"]` and the worktree is on branch `task/add-auth`
- **THEN** the slug resolves to `add-auth`

#### Scenario: Slug from the main checkout
- **WHEN** an operation with a command that prints `${slug}` is started in the primary checkout and no slug is given
- **THEN** the slug is `main` and the command prints `main`

#### Scenario: Slug from a variant directory
- **WHEN** an operation with a command that prints `${slug}` is started in the worktree on branch `feat/add-auth` and no slug is given
- **THEN** the slug is `add-auth` and the command prints `add-auth`

#### Scenario: Root workspace needs an explicit slug
- **WHEN** the current directory is the variant root and no slug is given
- **THEN** the system returns an error with a usage hint and does not inspect git in the variant root

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

### Requirement: Worktree coupling

The system SHALL create `_v-<slug>` worktrees below the resolved `variant.root` with `git worktree add` in the resolved `variant.main` when variant operations require it, and reuse one that exists. Variant operations SHALL NOT change the working directory of the process. A new worktree SHALL start a branch named with the first of `variant.branchPrefixes` from `variant.baseBranch`, unless a branch named with any configured prefix already exists, which SHALL be checked out instead. When the root is the main tree or lies inside it and a `.gitignore` exists there, creating a worktree SHALL add the line `<prefix>*` (for example `_v-*`) to that `.gitignore` unless a line already ignores it (`<prefix>*` or `/<prefix>*`, with or without a trailing `/`; a comment does not count). The system SHALL NOT create a `.gitignore` and SHALL NOT change one when the root is outside the main tree. When the process working directory is the variant root, `create`, `watch`, `down`, and `implode` of an explicit slug SHALL inspect git in the resolved `variant.main` and SHALL NOT fail because the variant root is not a git checkout. They SHALL NOT need a `variants.yaml` in the variant root. `watch` of a slug other than `main` SHALL run each watch command, and the provisioning command of each watch, with the watch's `dir` resolved against that slug's worktree. `watch` of `main` SHALL run in the primary checkout. `implode` SHALL remove the worktree through `variant.main`. `${slug}` in those commands SHALL expand to the explicit slug.

#### Scenario: Ensure worktree on create
- **WHEN** `create("add-auth")` is called from the primary worktree
- **THEN** `_v-add-auth` is created on `feat/add-auth` below the resolved root and the result holds its path
- **AND** the working directory of the process is unchanged

#### Scenario: Main slug stays in primary
- **WHEN** the slug resolves to `main`
- **THEN** no worktree is created and the process stays in the primary checkout

#### Scenario: Worktree uses resolved variant root
- **WHEN** `create("add-auth")` requires a worktree and `variant.root` resolves to `/workspace`
- **THEN** the worktree path is `/workspace/_v-add-auth`

#### Scenario: Worktree created from the main tree
- **WHEN** `variant.main` is `/work/app`, the process runs in `/elsewhere`, and `create("add-auth")` requires a worktree
- **THEN** the worktree is added to the repository of `/work/app`

#### Scenario: Watch from the repository with the workspace layout
- **WHEN** `watch("foo")` runs from `/work/app` and `/work/AGENTS.md` is a symlink into it
- **THEN** the worktree `/work/_v-foo` is created on `feat/foo` from `variant.baseBranch`

#### Scenario: Create from the variant root
- **WHEN** `create("foo")` runs in `/work`, `/work` is not a git checkout and has no `variants.yaml`, `/work/AGENTS.md` is a symlink to `/work/app/AGENTS.md`, and `/work/app/variants.yaml` is a real file
- **THEN** the worktree `/work/_v-foo` is created
- **AND** the call does not fail with `Unable to inspect git worktree from /work`

#### Scenario: Watch from the variant root
- **WHEN** `watch("foo")` runs in that same `/work` and `/work/_v-foo` is already a worktree of `/work/app` for slug `foo`
- **THEN** git is inspected in `/work/app`
- **AND** a watch whose `dir` is `be` and whose command prints `${slug}` runs in `/work/_v-foo/be` and prints `foo`

#### Scenario: Main from the variant root
- **WHEN** `watch("main")` runs from `/work` in that layout
- **THEN** it runs in `/work/app` and does not inspect git in `/work`

#### Scenario: Implode from the variant root
- **WHEN** `implode("foo")` runs from `/work` in that layout and the merge gate allows removal
- **THEN** the worktree is removed through the repository at `/work/app`
- **AND** the call does not fail with `Unable to inspect git worktree from /work`

#### Scenario: Configured base branch and prefix
- **WHEN** `variant.baseBranch` is `develop`, `variant.branchPrefixes` is `["task/"]` and `create("add-auth")` requires a worktree
- **THEN** branch `task/add-auth` is created from `develop`

#### Scenario: Existing branch with another configured prefix
- **WHEN** `variant.branchPrefixes` is `["feat/", "fix/"]` and branch `fix/add-auth` already exists
- **THEN** the worktree checks out `fix/add-auth`

#### Scenario: Worktree inside the main tree is git-ignored
- **WHEN** the root is the main tree, its `.gitignore` exists without an entry for `_v-*`, and a worktree is created
- **THEN** `.gitignore` ends with the line `_v-*`

#### Scenario: Ignore entry already present
- **WHEN** the root is the main tree and its `.gitignore` already has the line `_v-*` (or `/_v-*`)
- **THEN** `.gitignore` is unchanged, also after a second worktree is created

#### Scenario: No gitignore file
- **WHEN** the root is the main tree and no `.gitignore` exists
- **THEN** none is created

#### Scenario: Worktree outside the main tree
- **WHEN** the root is the directory that holds the main tree
- **THEN** no `.gitignore` is changed

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

### Requirement: Watch commands run in the watch directory

The system SHALL run the `up` command of an entry of `variant.watches` during provisioning with the watch's `dir`, resolved against the variant's worktree, as its working directory. The variant-wide `up` command used when no watches exist, and the seed command, SHALL run in the worktree root.

#### Scenario: Watch command runs in its directory

- **WHEN** a watch with `dir: be` and `up: pwd` is provisioned in a worktree `/w`
- **THEN** the command runs in `/w/be`

#### Scenario: Seed runs in the worktree root

- **WHEN** a variant with watches and a seed command is provisioned
- **THEN** the seed command runs in the worktree root

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
