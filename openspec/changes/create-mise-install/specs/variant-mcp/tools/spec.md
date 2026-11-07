## ADDED Requirements

### Requirement: miseInstall on create

The tool `variant_create` SHALL accept an optional string `miseInstall` whose only values are `bg`, `sync`, and `no`. When `miseInstall` is omitted, the tool SHALL run as `bg` as the core capability specifies. When the value is `no`, the tool SHALL NOT run Mise. A value other than those three SHALL be rejected and SHALL NOT create a worktree. No other variant tool SHALL accept `miseInstall`.

#### Scenario: Omitted means background

- **WHEN** an MCP client calls `variant_create({ slug: "test-feature" })` and `install` sleeps
- **THEN** the call returns while `install` is still running

#### Scenario: Explicit no

- **WHEN** an MCP client calls `variant_create({ slug: "test-feature", miseInstall: "no" })`
- **THEN** Mise does not run

#### Scenario: Sync

- **WHEN** an MCP client calls `variant_create({ slug: "test-feature", miseInstall: "sync" })` and both Mise commands exit 0
- **THEN** the call returns only after `install` has exited
- **AND** `trust --all` ran against that worktree before `install`

#### Scenario: Invalid value

- **WHEN** an MCP client calls `variant_create({ slug: "test-feature", miseInstall: "later" })` and no worktree for `test-feature` exists
- **THEN** the tool returns an error
- **AND** no worktree for `test-feature` exists

#### Scenario: Other tools reject miseInstall

- **WHEN** an MCP client calls `variant_provision`, `variant_up`, `variant_watch`, `variant_down`, or `variant_implode` with `miseInstall`
- **THEN** the tool rejects the argument
