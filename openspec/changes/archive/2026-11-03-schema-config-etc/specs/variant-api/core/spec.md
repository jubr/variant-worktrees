## RENAMED Requirements

- FROM: `### Requirement: Instance commands run in the instance directory`
- TO: `### Requirement: Watch commands run in the watch directory`

## MODIFIED Requirements

### Requirement: List variants

The system SHALL return an inventory of known variants from state files, the database, and the `runtime` sections of the `variants.local.yaml` files of the main checkout and of every `<prefix>*` worktree below the variant root, merged by slug. Each record SHALL carry, when known, the worktree directory, the runtime `mode`, the URL of the first watch that has one, the database target, and for every watch its `port`, `pid`, `url` and whether the pid is alive. A value from several sources SHALL be taken from state first, then runtime, then the database. A runtime file that cannot be read SHALL NOT fail the call.

Each record that has a directory SHALL carry `createdMs` and `changedMs`, epoch milliseconds. `createdMs` SHALL be the earlier birth time of that directory and of its `variants.local.yaml`, skipping a path that does not exist. `changedMs` SHALL be the later modification time of those same paths. A record with no directory SHALL omit both.

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

- **WHEN** a variant directory was created before its `variants.local.yaml`, and the file was modified after the directory
- **THEN** `createdMs` is the directory's birth time and `changedMs` is the file's modification time

#### Scenario: No local file

- **WHEN** a variant has a directory and no `variants.local.yaml`
- **THEN** `createdMs` and `changedMs` are that directory's birth time and modification time

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

### Requirement: Watch commands run in the watch directory

The system SHALL run the `up` command of an entry of `variant.watches` during provisioning with the watch's `dir`, resolved against the variant's worktree, as its working directory. The variant-wide `up` command used when no watches exist, and the seed command, SHALL run in the worktree root.

#### Scenario: Instance command runs in its directory

- **WHEN** a watch with `dir: be` and `up: pwd` is provisioned in a worktree `/w`
- **THEN** the command runs in `/w/be`

#### Scenario: Seed runs in the worktree root

- **WHEN** a variant with watches and a seed command is provisioned
- **THEN** the seed command runs in the worktree root
