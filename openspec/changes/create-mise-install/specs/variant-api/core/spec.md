## ADDED Requirements

### Requirement: Create installs Mise tools

`create`, `provision`, and `watch` SHALL accept `miseInstall` of `bg`, `sync`, or `no`. When the value is omitted on those calls, it SHALL mean `bg`. `up` SHALL NOT accept `miseInstall` and SHALL NOT run this install. When the value is anything else, the call SHALL fail before it creates a worktree.

`bg` and `sync` SHALL run only when the worktree contains a Mise config: `mise.toml`, `.mise.toml`, `.config/mise/config.toml`, `mise/config.toml`, or `.tool-versions`, in that worktree and not in a parent directory. When none of those files is present, the call SHALL NOT run Mise and SHALL NOT fail because Mise is absent. `no` SHALL NOT run Mise.

When a Mise config is present, the mode is `bg` or `sync`, and no Mise executable can be resolved, the call SHALL fail, the worktree SHALL remain, and the error SHALL say that Mise was not found and SHALL name `variant.mise.binPath`.

When a Mise config is present and the mode is `bg` or `sync`, the call SHALL run the resolved Mise executable against that worktree as `trust --all`, and SHALL run `install` against that worktree only after `trust` exits 0. The process working directory SHALL stay unchanged. The run SHALL NOT read the caller's standard input. `provision` and `watch` SHALL pass `miseInstall` through to this create install. The install SHALL NOT have a configuration-file key.

When the value is `bg`, the call SHALL return while that run is still in progress, and the run SHALL continue after the call returns. The run's output SHALL replace `{worktree}/.cache/variant/mise-install.log`. The call SHALL write one line to standard error that says the install started in the background and includes that log path. A non-zero exit of the run SHALL NOT fail the call. When the run cannot be started, the call SHALL fail, and the worktree SHALL remain.

When the value is `sync`, the call SHALL NOT return until the run exits. The run's output SHALL be written to standard error. A non-zero exit SHALL fail the call, the error SHALL include that output, and the worktree SHALL remain.

When the slug resolves to `main`, or the call produces no worktree, it SHALL NOT run Mise for any value.

#### Scenario: Background install returns before it finishes

- **WHEN** `create("add-auth", { miseInstall: "bg" })` creates a worktree that contains `mise.toml` and the Mise executable sleeps inside `install`
- **THEN** the call returns while `install` is still running
- **AND** standard error contains one line that says the install started in the background and includes `{worktree}/.cache/variant/mise-install.log`
- **AND** the process working directory is unchanged

#### Scenario: Background install finishes after the call

- **WHEN** `create("add-auth", { miseInstall: "bg" })` creates a worktree that contains `mise.toml` and `install` writes a marker when it exits
- **THEN** the marker is absent when the call returns
- **AND** the marker is present afterwards
- **AND** `trust --all` ran against that worktree before `install`

#### Scenario: Background output replaces the log

- **WHEN** `create("add-auth", { miseInstall: "bg" })` runs in a worktree that contains `mise.toml` and `mise-install.log` already has older text
- **THEN** `{worktree}/.cache/variant/mise-install.log` holds this run's output and does not hold that older text

#### Scenario: Background trust failure does not install or fail the call

- **WHEN** `create("add-auth", { miseInstall: "bg" })` creates a worktree that contains `mise.toml` and `trust --all` exits non-zero
- **THEN** the call succeeds
- **AND** `install` does not run
- **AND** the worktree remains
- **AND** the log contains the trust output

#### Scenario: Sync waits for a successful install

- **WHEN** `create("add-auth", { miseInstall: "sync" })` creates a worktree that contains `mise.toml` and both Mise commands exit 0
- **THEN** the call returns only after `install` has exited
- **AND** `trust --all` ran against that worktree before `install`
- **AND** standard error contains both commands' output
- **AND** the process working directory is unchanged

#### Scenario: Sync trust failure leaves the worktree

- **WHEN** `create("add-auth", { miseInstall: "sync" })` creates a worktree that contains `mise.toml` and `trust --all` exits non-zero
- **THEN** the call fails
- **AND** the error includes the trust output
- **AND** `install` does not run
- **AND** the worktree remains

#### Scenario: Sync install failure leaves the worktree

- **WHEN** `create("add-auth", { miseInstall: "sync" })` creates a worktree that contains `mise.toml`, `trust --all` exits 0, and `install` exits non-zero
- **THEN** the call fails
- **AND** the error includes the install output
- **AND** the worktree remains

#### Scenario: No skips Mise

- **WHEN** `create("add-auth", { miseInstall: "no" })` creates a worktree that contains `mise.toml`
- **THEN** Mise does not run

#### Scenario: Omitted create installs when the worktree has a Mise config

- **WHEN** `create("add-auth")` creates a worktree that contains `mise.toml` and `miseInstall` is omitted
- **THEN** the call returns while `install` is still running

#### Scenario: Omitted create skips a worktree with no Mise config

- **WHEN** `create("add-auth")` creates a worktree that contains none of the Mise config files and `miseInstall` is omitted
- **THEN** Mise does not run
- **AND** the call succeeds

#### Scenario: A parent Mise config is not the worktree's

- **WHEN** `create("add-auth")` creates a worktree that contains no Mise config file and a parent directory contains `mise.toml`
- **THEN** Mise does not run

#### Scenario: Existing worktree still installs

- **WHEN** a worktree for `add-auth` already exists, it contains `mise.toml`, and `create("add-auth", { miseInstall: "sync" })` runs
- **THEN** `trust --all` and `install` run against that worktree

#### Scenario: Main does not install

- **WHEN** the slug resolves to `main` and `create("main", { miseInstall: "sync" })` runs in a checkout that contains `mise.toml`
- **THEN** Mise does not run

#### Scenario: Missing Mise leaves the worktree

- **WHEN** the worktree would contain `mise.toml`, no Mise executable can be resolved, and `create("add-auth", { miseInstall: "bg" })` runs
- **THEN** the call fails
- **AND** the error says that Mise was not found and names `variant.mise.binPath`
- **AND** the worktree for `add-auth` remains

#### Scenario: Invalid value creates no worktree

- **WHEN** `create("add-auth", { miseInstall: "later" })` would create a worktree
- **THEN** the call fails
- **AND** no worktree for `add-auth` exists

#### Scenario: Spawn failure leaves the worktree

- **WHEN** `create("add-auth", { miseInstall: "bg" })` creates a worktree that contains `mise.toml` and the install process cannot be started
- **THEN** the call fails
- **AND** the worktree remains

#### Scenario: Provision and watch pass the install through

- **WHEN** `provision("add-auth", { miseInstall: "sync" })` or `watch("add-auth", { miseInstall: "sync" })` creates a worktree that contains `mise.toml` and both Mise commands exit 0
- **THEN** `trust --all` and `install` run against that worktree
- **AND** the call returns only after `install` has exited

#### Scenario: Up does not install

- **WHEN** `up("add-auth")` creates a worktree that contains `mise.toml`
- **THEN** Mise trust and install do not run
