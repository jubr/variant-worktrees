## ADDED Requirements

### Requirement: Create installs Mise tools

`create` SHALL accept `miseInstall` of `bg`, `sync`, or `no`. When the value is omitted on the library call, or is `no`, `create` SHALL NOT run Mise. When the value is anything else, `create` SHALL fail before it creates a worktree.

When the value is `bg` or `sync` and no Mise executable can be resolved, `create` SHALL fail before it creates a worktree. The error SHALL say that Mise was not found and SHALL name `variant.mise.binPath`.

When the value is `bg` or `sync` and `create` has a worktree directory, including a worktree that already existed, `create` SHALL run the resolved Mise executable against that directory as `trust --all`, and SHALL run `install` against that directory only after `trust` exits 0. The process working directory SHALL stay unchanged. The run SHALL NOT read the caller's standard input.

When the value is `bg`, `create` SHALL return while that run is still in progress, and the run SHALL continue after the call returns. The run's output SHALL replace `{worktree}/.cache/variant/mise-install.log`. `create` SHALL write one line to standard error that says the install started in the background and includes that log path. A non-zero exit of the run SHALL NOT fail the call. When the run cannot be started, `create` SHALL fail, and a worktree this call already created SHALL remain.

When the value is `sync`, `create` SHALL NOT return until the run exits. The run's output SHALL be written to standard error. A non-zero exit SHALL fail the call, the error SHALL include that output, and the worktree SHALL remain.

When the slug resolves to `main`, or `create` produces no worktree, `create` SHALL NOT run Mise for any value. `provision`, `up`, and `watch` SHALL NOT run this install, including when they create a worktree.

#### Scenario: Background install returns before it finishes

- **WHEN** `create("add-auth", { miseInstall: "bg" })` creates a worktree and the Mise executable sleeps inside `install`
- **THEN** the call returns while `install` is still running
- **AND** standard error contains one line that says the install started in the background and includes `{worktree}/.cache/variant/mise-install.log`
- **AND** the process working directory is unchanged

#### Scenario: Background install finishes after the call

- **WHEN** `create("add-auth", { miseInstall: "bg" })` creates a worktree and `install` writes a marker when it exits
- **THEN** the marker is absent when the call returns
- **AND** the marker is present afterwards
- **AND** `trust --all` ran against that worktree before `install`

#### Scenario: Background output replaces the log

- **WHEN** `create("add-auth", { miseInstall: "bg" })` runs and the worktree's `mise-install.log` already has older text
- **THEN** `{worktree}/.cache/variant/mise-install.log` holds this run's output and does not hold that older text

#### Scenario: Background trust failure does not install or fail the call

- **WHEN** `create("add-auth", { miseInstall: "bg" })` creates a worktree and `trust --all` exits non-zero
- **THEN** the call succeeds
- **AND** `install` does not run
- **AND** the worktree remains
- **AND** the log contains the trust output

#### Scenario: Sync waits for a successful install

- **WHEN** `create("add-auth", { miseInstall: "sync" })` creates a worktree and both Mise commands exit 0
- **THEN** the call returns only after `install` has exited
- **AND** `trust --all` ran against that worktree before `install`
- **AND** standard error contains both commands' output
- **AND** the process working directory is unchanged

#### Scenario: Sync trust failure leaves the worktree

- **WHEN** `create("add-auth", { miseInstall: "sync" })` creates a worktree and `trust --all` exits non-zero
- **THEN** the call fails
- **AND** the error includes the trust output
- **AND** `install` does not run
- **AND** the worktree remains

#### Scenario: Sync install failure leaves the worktree

- **WHEN** `create("add-auth", { miseInstall: "sync" })` creates a worktree, `trust --all` exits 0, and `install` exits non-zero
- **THEN** the call fails
- **AND** the error includes the install output
- **AND** the worktree remains

#### Scenario: No skips Mise

- **WHEN** `create("add-auth", { miseInstall: "no" })` creates a worktree
- **THEN** Mise does not run

#### Scenario: Omitted library option skips Mise

- **WHEN** `create("add-auth")` creates a worktree and `miseInstall` is omitted
- **THEN** Mise does not run

#### Scenario: Existing worktree still installs

- **WHEN** a worktree for `add-auth` already exists and `create("add-auth", { miseInstall: "sync" })` runs
- **THEN** `trust --all` and `install` run against that worktree

#### Scenario: Main does not install

- **WHEN** the slug resolves to `main` and `create("main", { miseInstall: "sync" })` runs
- **THEN** Mise does not run

#### Scenario: Missing Mise creates no worktree

- **WHEN** no Mise executable can be resolved and `create("add-auth", { miseInstall: "bg" })` would create a worktree
- **THEN** the call fails
- **AND** the error says that Mise was not found and names `variant.mise.binPath`
- **AND** no worktree for `add-auth` exists

#### Scenario: Invalid value creates no worktree

- **WHEN** `create("add-auth", { miseInstall: "later" })` would create a worktree
- **THEN** the call fails
- **AND** no worktree for `add-auth` exists

#### Scenario: Spawn failure leaves the worktree

- **WHEN** `create("add-auth", { miseInstall: "bg" })` creates a worktree and the install process cannot be started
- **THEN** the call fails
- **AND** the worktree remains

#### Scenario: Provision does not install

- **WHEN** `provision("add-auth")`, `up("add-auth")`, or `watch("add-auth")` creates a worktree
- **THEN** Mise trust and install do not run
