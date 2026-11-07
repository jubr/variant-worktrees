# variant-mcp tools Specification

## Purpose

The MCP server exposes database variant lifecycle operations to agents and
other MCP clients through stable, typed tools.

## Requirements

### Requirement: variant_list tool

The system SHALL expose a `variant_list` MCP tool returning variant inventory. It SHALL accept an optional `verbose` flag; with it every item carries all meta information that `variant_status` returns, including the `runtime` object.

#### Scenario: List variants
- **WHEN** an MCP client calls `variant_list` with no args
- **THEN** the result is an array of objects with slug, schema or database, state, and worktree, plus mode, uptime and log file where known

#### Scenario: Verbose list
- **WHEN** an MCP client calls `variant_list({ verbose: true })`
- **THEN** each item equals the result of `variant_status` for its slug

### Requirement: variant_create tool

The system SHALL expose a `variant_create` MCP tool accepting a slug argument and an optional string `from`. When `from` is set and this call creates the variant branch, that branch SHALL start at the commit `from` names (see the core capability).

#### Scenario: Create variant
- **WHEN** an MCP client calls `variant_create({ slug: "test-feature" })`
- **THEN** a variant schema or database is created, a worktree is ensured, and the result includes the state path

#### Scenario: Create from a commit-ish
- **WHEN** an MCP client calls `variant_create({ slug: "test-feature", from: "feat/other" })` and the variant branch does not yet exist
- **THEN** the new branch HEAD is the commit `feat/other` resolves to

### Requirement: variant_provision tool

The system SHALL expose a `variant_provision` MCP tool that runs the configured seed command for a variant. It SHALL accept an optional string `from`. When `from` is set and this call creates the variant branch, that branch SHALL start at the commit `from` names.

#### Scenario: Provision with seed
- **WHEN** an MCP client calls `variant_provision({ slug: "test-feature" })` and `variants.yaml` defines a seed command
- **THEN** the seed command executes with variant environment and the result includes command output

#### Scenario: Provision with migration command
- **WHEN** a watch has `up = "bun run migrate"`
- **THEN** provision runs that command before the seed command

#### Scenario: Provision from a commit-ish
- **WHEN** an MCP client calls `variant_provision({ slug: "test-feature", from: "feat/other" })` and the variant branch does not yet exist
- **THEN** the new branch HEAD is the commit `feat/other` resolves to

### Requirement: variant_up tool

The system SHALL expose a `variant_up` MCP tool accepting an optional slug, an optional `verbose` flag, and an optional string `from` that runs `up` for that variant and returns the slug, mode, worktree, database target and the port, URL and container name of each watch. When `from` is set and this call creates the variant branch, that branch SHALL start at the commit `from` names.

#### Scenario: Up a variant

- **WHEN** an MCP client calls `variant_up({ slug: "test-feature" })` and the variant has a containerized watch
- **THEN** the watch container is started and the result includes its port and URL

#### Scenario: Up from a commit-ish

- **WHEN** an MCP client calls `variant_up({ slug: "test-feature", from: "feat/other" })` and the variant branch does not yet exist
- **THEN** the new branch HEAD is the commit `feat/other` resolves to

### Requirement: variant_watch tool

The system SHALL expose a `variant_watch` MCP tool accepting an optional slug and an optional string `from` that runs `watch` detached, because a tool call cannot stay attached to a console. The result SHALL include the slug, worktree and, per watch, the pid, port and URL. When `from` is set and this call creates the variant branch, that branch SHALL start at the commit `from` names.

#### Scenario: Watch returns

- **WHEN** an MCP client calls `variant_watch({ slug: "test-feature" })`
- **THEN** the call returns while the watch processes keep running, and the result lists their pids

#### Scenario: Watch from a commit-ish

- **WHEN** an MCP client calls `variant_watch({ slug: "test-feature", from: "feat/other" })` and the variant branch does not yet exist
- **THEN** the new branch HEAD is the commit `feat/other` resolves to

### Requirement: variant_down tool

The system SHALL expose a `variant_down` MCP tool accepting an optional slug that stops the runtime of the variant and keeps its data.

#### Scenario: Down a variant

- **WHEN** an MCP client calls `variant_down({ slug: "test-feature" })`
- **THEN** the processes and containers of the variant are stopped and the result lists what was stopped

### Requirement: variant_implode tool

The system SHALL expose a `variant_implode` MCP tool accepting an optional slug, an optional `force` flag, and an optional `branchRm` choice of `yes` or `no` that implodes the variant (see the implode capability) and returns the implode report, the removed worktree path, and whether the local branch was removed. Omitted `branchRm` SHALL remove the local branch. The tool SHALL reject a `branchRm` value other than `yes` or `no`. The tool `variant_destroy` SHALL NOT exist.

#### Scenario: Implode a merged variant

- **WHEN** an MCP client calls `variant_implode({ slug: "test-feature" })` for a merged variant on branch `feat/test-feature`
- **THEN** the variant is dropped, state is cleared, the worktree is removed, the local branch is removed, and the result names the worktree and the branch

#### Scenario: Branch kept

- **WHEN** an MCP client calls `variant_implode({ slug: "test-feature", branchRm: "no" })` for a merged variant on branch `feat/test-feature`
- **THEN** the worktree is removed and the local branch `feat/test-feature` still exists

#### Scenario: Unmerged refused

- **WHEN** an MCP client calls `variant_implode({ slug: "test-feature" })` for an unmerged variant without `force`
- **THEN** the tool returns an error that names `force`

#### Scenario: Boolean branchRm rejected

- **WHEN** an MCP client calls `variant_implode({ slug: "test-feature", branchRm: true })`
- **THEN** the tool returns an error and the variant is unchanged

#### Scenario: Destroy tool is gone

- **WHEN** an MCP client lists tools
- **THEN** the result has no `variant_destroy` tool

### Requirement: variant_status tool

The system SHALL expose a `variant_status` MCP tool accepting an optional slug that returns the status of that single variant as JSON: the facts `list` returns for it, including `uptimeSeconds` and `log`, and a `runtime` object with the meta information of its runtime state (see the status capability), with database passwords redacted. An unknown slug SHALL produce an error result naming the slug.

#### Scenario: Status of a variant

- **WHEN** an MCP client calls `variant_status({ slug: "test-feature" })` for a variant with a runtime state
- **THEN** the result is JSON with `slug` `test-feature`, its `mode`, and a `runtime` object with its watches

#### Scenario: Unknown slug

- **WHEN** an MCP client calls `variant_status({ slug: "ghost" })` and `ghost` is unknown
- **THEN** the result is an error that names `ghost`

### Requirement: pullFf on worktree-creating tools

The tools `variant_create`, `variant_provision`, `variant_up`, and `variant_watch` SHALL accept an optional boolean `pullFf`. When `pullFf` is true and that call creates the variant branch, the start branch SHALL be fast-forwarded as the core capability specifies. No other variant tool SHALL accept `pullFf`.

#### Scenario: Create with pullFf

- **WHEN** an MCP client calls `variant_create({ slug: "test-feature", pullFf: true })` and the variant branch does not yet exist
- **THEN** the start branch is fast-forwarded before the worktree exists
- **AND** the new branch HEAD is that updated tip

#### Scenario: Provision with pullFf

- **WHEN** an MCP client calls `variant_provision({ slug: "test-feature", pullFf: true })` and the variant branch does not yet exist
- **THEN** the start branch is fast-forwarded before the worktree exists
- **AND** the new branch HEAD is that updated tip

#### Scenario: Up with pullFf

- **WHEN** an MCP client calls `variant_up({ slug: "test-feature", pullFf: true })` and the variant branch does not yet exist
- **THEN** the start branch is fast-forwarded before the worktree exists
- **AND** the new branch HEAD is that updated tip

#### Scenario: Watch with pullFf

- **WHEN** an MCP client calls `variant_watch({ slug: "test-feature", pullFf: true })` and the variant branch does not yet exist
- **THEN** the start branch is fast-forwarded before the worktree exists
- **AND** the new branch HEAD is that updated tip

#### Scenario: Other tools reject pullFf

- **WHEN** an MCP client calls `variant_down` or `variant_implode` with `pullFf`
- **THEN** the tool rejects the argument

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
