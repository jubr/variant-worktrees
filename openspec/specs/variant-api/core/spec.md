# variant-api core Specification

## Purpose

The core API manages isolated database variants, git worktrees, slugs, and
portable YAML state across supported database engines.

## Requirements

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

The system SHALL create `_v-<slug>` worktrees below the resolved `variant.root` with `git worktree add` in the resolved `variant.main` when variant operations require it, and reuse one that exists. Variant operations SHALL NOT change the working directory of the process. A new worktree SHALL start a branch named with the first of `variant.branchPrefixes` from the commit-ish given as `from` when the operation sets `from`, and otherwise from `variant.baseBranch`, unless a branch named with any configured prefix already exists, which SHALL be checked out instead. `from` SHALL be a branch, tag, or commit that git can resolve in the repository of `variant.main`. A relative name such as `HEAD` SHALL be the HEAD of the process working directory when that directory is a worktree of that repository, and otherwise the HEAD of `variant.main`. When `from` is set and git cannot resolve it, the operation SHALL fail and SHALL leave no new branch and no new worktree. An existing worktree for the slug SHALL be reused, and `from` SHALL NOT move its branch. `from` SHALL NOT change the branch `implode` uses as its merge base. When the root is the main tree or lies inside it and a `.gitignore` exists there, creating a worktree SHALL add the line `<prefix>*` (for example `_v-*`) to that `.gitignore` unless a line already ignores it (`<prefix>*` or `/<prefix>*`, with or without a trailing `/`; a comment does not count). The system SHALL NOT create a `.gitignore` and SHALL NOT change one when the root is outside the main tree. When the process working directory is the variant root, `create`, `watch`, `down`, and `implode` of an explicit slug SHALL inspect git in the resolved `variant.main` and SHALL NOT fail because the variant root is not a git checkout. They SHALL NOT need a `variants.yaml` in the variant root. `watch` of a slug other than `main` SHALL run each watch command, and the provisioning command of each watch, with the watch's `dir` resolved against that slug's worktree. `watch` of `main` SHALL run in the primary checkout. `implode` SHALL remove the worktree through `variant.main`. `${slug}` in those commands SHALL expand to the explicit slug.

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

#### Scenario: Create from a commit-ish
- **WHEN** `create("add-auth", { from })` requires a worktree, no branch under `variant.branchPrefixes` exists for that slug, and `from` resolves to a commit other than the tip of `variant.baseBranch`
- **THEN** branch `feat/add-auth` is created with that commit as its HEAD

#### Scenario: Provision from a commit-ish
- **WHEN** `provision("add-auth", { from })` requires a worktree and no prefixed branch exists for that slug
- **THEN** the new branch HEAD is the commit `from` resolves to

#### Scenario: Up from a commit-ish
- **WHEN** `up("add-auth", { from })` requires a worktree and no prefixed branch exists for that slug
- **THEN** the new branch HEAD is the commit `from` resolves to

#### Scenario: Watch from a commit-ish
- **WHEN** `watch("add-auth", { from })` requires a worktree and no prefixed branch exists for that slug
- **THEN** the new branch HEAD is the commit `from` resolves to

#### Scenario: HEAD is the current worktree
- **WHEN** the process working directory is a worktree of the repository whose HEAD is commit C, and `create("add-auth", { from: "HEAD" })` creates a branch
- **THEN** the new branch HEAD is C

#### Scenario: HEAD outside a checkout
- **WHEN** the process working directory is not a worktree of the repository, `variant.main` HEAD is commit M, and `create("add-auth", { from: "HEAD" })` creates a branch
- **THEN** the new branch HEAD is M

#### Scenario: Existing branch ignores from
- **WHEN** branch `fix/add-auth` already exists and `create("add-auth", { from })` runs with `from` resolving to a different commit
- **THEN** the worktree checks out `fix/add-auth` at that branch's existing HEAD

#### Scenario: Existing worktree ignores from
- **WHEN** a worktree for `add-auth` already exists and `create("add-auth", { from })` runs
- **THEN** that worktree is reused and its HEAD is unchanged

#### Scenario: Unknown commit-ish
- **WHEN** `create("add-auth", { from: "no-such-commit" })` requires a worktree and no prefixed branch exists for that slug
- **THEN** the call fails
- **AND** branch `feat/add-auth` does not exist and the worktree directory does not exist

#### Scenario: From does not move the implode base
- **WHEN** a variant branch was created with `from` set to a commit that is not an ancestor of `variant.baseBranch`
- **THEN** `implode` of that slug without `force` still refuses because the work is not merged into `variant.baseBranch`

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

### Requirement: Fast-forward the start branch

When `pullFf` is set and the operation creates a new variant branch, the system SHALL fast-forward the start branch to its upstream before the worktree is added, and that new branch SHALL start at the updated tip. The start branch SHALL be the branch named by `from` when `from` names a branch, and SHALL be `variant.baseBranch` otherwise. Before that fast-forward, the system SHALL dry-run it. The dry-run SHALL detect a conflict with local changes, a divergence from the upstream, a missing upstream, and any other error that would make the fast-forward fail. The dry-run SHALL NOT move the start branch and SHALL NOT change that checkout's files. When the dry-run fails, the system SHALL NOT start the fast-forward, and the start branch and its checkout SHALL stay at their pre-call state, including local changes. When that branch is checked out in a worktree of the repository and the dry-run passes, the fast-forward SHALL run in that checkout and SHALL restore local changes stashed for the update. When that branch is checked out in no worktree and the dry-run passes, the fast-forward SHALL update the branch ref from its upstream and SHALL NOT change the files of any existing worktree. When a fast-forward starts and then fails, the system SHALL restore the start branch and its checkout to the pre-call state, including local changes, and SHALL leave no conflict markers. The system SHALL NOT pull the new variant branch. The system SHALL NOT create a merge commit on the start branch. When the start branch has no upstream, has diverged from its upstream, or the update fails, the operation SHALL fail and SHALL leave no new branch and no new worktree. The error SHALL name the failure and SHALL include one runnable `variant` command that repeats the same operation, including `--pull-ff`, the slug, and `from` when `from` was set. When `from` names a tag or a commit, `pullFf` SHALL NOT fetch and the new branch SHALL start at that commit. When an existing worktree for the slug is reused, or an existing branch under any configured prefix is checked out, `pullFf` SHALL NOT move that branch and SHALL NOT contact the remote. When the slug resolves to `main`, `pullFf` SHALL NOT fetch and SHALL NOT pull. When `pullFf` is omitted, the operation SHALL NOT fetch and SHALL NOT pull. The fast-forward SHALL NOT change the working directory of the process.

#### Scenario: Checked-out base branch is fast-forwarded first

- **WHEN** the primary checkout is on `main`, `main` tracks `origin/main`, `origin/main` is ahead of `main`, and `create("add-auth", { pullFf: true })` creates a branch
- **THEN** `main` in the primary checkout is fast-forwarded to `origin/main` before the worktree exists
- **AND** `feat/add-auth` HEAD is that updated tip
- **AND** the working directory of the process is unchanged

#### Scenario: Caller is not on the start branch

- **WHEN** the process working directory is a feature worktree, the primary checkout is on `main`, `origin/main` is ahead of `main`, and `create("add-auth", { pullFf: true })` creates a branch
- **THEN** the primary checkout is fast-forwarded
- **AND** the new worktree is not pulled
- **AND** `feat/add-auth` HEAD is the updated tip of `main`

#### Scenario: Local changes are restored

- **WHEN** the primary checkout is on `main` with local modifications, `origin/main` is a fast-forward of `main`, and `create("add-auth", { pullFf: true })` creates a branch
- **THEN** those modifications are present in the primary checkout after the call
- **AND** `feat/add-auth` HEAD is the updated tip of `main`

#### Scenario: Start branch is not checked out

- **WHEN** `main` is checked out in no worktree, `main` tracks `origin/main`, `origin/main` is ahead of `main`, and `create("add-auth", { pullFf: true })` creates a branch from `main`
- **THEN** the local `main` ref is the tip of `origin/main`
- **AND** no existing worktree's files change before the new worktree is added
- **AND** `feat/add-auth` HEAD is that tip

#### Scenario: From a checked-out branch

- **WHEN** `from` is `feat/other`, that branch is checked out in a worktree, its upstream is ahead of it, and `create("add-auth", { pullFf: true, from: "feat/other" })` creates a branch
- **THEN** that checkout is fast-forwarded to its upstream
- **AND** `feat/add-auth` HEAD is that updated tip
- **AND** the new worktree's branch is not pulled

#### Scenario: Tag or commit skips the fetch

- **WHEN** `from` names a tag or a commit, `pullFf` is set, and `create("add-auth", { pullFf: true, from })` creates a branch
- **THEN** no fetch runs
- **AND** `feat/add-auth` HEAD is that commit

#### Scenario: Diverged start branch aborts

- **WHEN** `main` has commits that are not in its upstream and `create("add-auth", { pullFf: true })` would create a branch
- **THEN** the call fails
- **AND** `main` stays at its previous tip
- **AND** branch `feat/add-auth` does not exist and the worktree directory does not exist
- **AND** the error names the divergence and includes a runnable `variant create` command with `--pull-ff` and the slug `add-auth`

#### Scenario: Dry-run stops a conflicting update

- **WHEN** the primary checkout is on `main` with local modifications that conflict with the commits on `origin/main`, and `create("add-auth", { pullFf: true })` would create a branch
- **THEN** the call fails before `main` moves
- **AND** those modifications are present, with no conflict markers
- **AND** branch `feat/add-auth` does not exist and the worktree directory does not exist
- **AND** the error names the conflict and includes a runnable `variant create` command with `--pull-ff` and the slug `add-auth`

#### Scenario: Failed update is restored

- **WHEN** the dry-run passes and the fast-forward of a checked-out start branch then fails
- **THEN** the call fails with no new branch and no new worktree
- **AND** the start branch ref and the checkout files match their pre-call state, including local changes and with no conflict markers
- **AND** the error names the failure and includes the runnable `variant` command that repeats the call

#### Scenario: Missing upstream aborts

- **WHEN** `main` has no upstream and `create("add-auth", { pullFf: true })` would create a branch
- **THEN** the call fails before a branch or worktree exists
- **AND** the error says that `main` has no upstream and includes a runnable `variant create` command with `--pull-ff` and the slug `add-auth`

#### Scenario: Retry command keeps from

- **WHEN** `variant create --pull-ff --from feat/other --slug demo` fails while fast-forwarding `feat/other`
- **THEN** the error includes one runnable line containing `variant create`, `--pull-ff`, `--from feat/other`, and the slug `demo`

#### Scenario: Existing worktree ignores pullFf

- **WHEN** a worktree for `add-auth` already exists and `create("add-auth", { pullFf: true })` runs
- **THEN** that worktree is reused and its HEAD is unchanged
- **AND** no fetch runs

#### Scenario: Existing prefixed branch ignores pullFf

- **WHEN** branch `fix/add-auth` already exists and `create("add-auth", { pullFf: true })` runs
- **THEN** the worktree checks out `fix/add-auth` at that branch's existing HEAD
- **AND** no fetch runs

#### Scenario: Main slug does not pull

- **WHEN** the slug resolves to `main` and `pullFf` is set
- **THEN** no worktree is created
- **AND** no fetch runs

#### Scenario: Omitted pullFf does not fetch

- **WHEN** `origin/main` is ahead of local `main` and `create("add-auth")` creates a branch
- **THEN** local `main` stays at its previous tip
- **AND** `feat/add-auth` HEAD is that previous tip

#### Scenario: Implied commands fast-forward

- **WHEN** `provision("add-auth", { pullFf: true })`, `up("add-auth", { pullFf: true })`, or `watch("add-auth", { pullFf: true })` creates a branch and the start branch's upstream is ahead
- **THEN** the start branch is fast-forwarded before the worktree exists
- **AND** the new branch HEAD is that updated tip
