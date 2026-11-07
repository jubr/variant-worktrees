## ADDED Requirements

### Requirement: miseInstall on create, provision, and watch

The tools `variant_create`, `variant_provision`, and `variant_watch` SHALL accept an optional string `miseInstall` whose only values are `bg`, `sync`, and `no`. When `miseInstall` is omitted, the tool SHALL run as `bg` as the core capability specifies. When the value is `no`, the tool SHALL NOT run Mise. A value other than those three SHALL be rejected and SHALL NOT create a worktree. No other variant tool SHALL accept `miseInstall`.

#### Scenario: Omitted means background

- **WHEN** an MCP client calls `variant_create({ slug: "test-feature" })` for a worktree that contains `mise.toml` and `install` sleeps
- **THEN** the call returns while `install` is still running

#### Scenario: Explicit no

- **WHEN** an MCP client calls `variant_create({ slug: "test-feature", miseInstall: "no" })` for a worktree that contains `mise.toml`
- **THEN** Mise does not run

#### Scenario: Sync on provision

- **WHEN** an MCP client calls `variant_provision({ slug: "test-feature", miseInstall: "sync" })` for a worktree that contains `mise.toml` and both Mise commands exit 0
- **THEN** the call returns only after `install` has exited
- **AND** `trust --all` ran against that worktree before `install`

#### Scenario: Watch accepts the argument

- **WHEN** an MCP client calls `variant_watch({ slug: "test-feature", miseInstall: "no" })`
- **THEN** the tool accepts `miseInstall`

#### Scenario: Invalid value

- **WHEN** an MCP client calls `variant_create({ slug: "test-feature", miseInstall: "later" })` and no worktree for `test-feature` exists
- **THEN** the tool returns an error
- **AND** no worktree for `test-feature` exists

#### Scenario: Other tools reject miseInstall

- **WHEN** an MCP client calls `variant_up`, `variant_down`, or `variant_implode` with `miseInstall`
- **THEN** the tool rejects the argument
