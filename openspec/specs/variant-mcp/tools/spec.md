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

The system SHALL expose a `variant_create` MCP tool accepting a slug argument.

#### Scenario: Create variant
- **WHEN** an MCP client calls `variant_create({ slug: "test-feature" })`
- **THEN** a variant schema or database is created, a worktree is ensured, and the result includes the state path

### Requirement: variant_provision tool

The system SHALL expose a `variant_provision` MCP tool that runs the configured seed command for a variant.

#### Scenario: Provision with seed
- **WHEN** an MCP client calls `variant_provision({ slug: "test-feature" })` and `variants.yaml` defines a seed command
- **THEN** the seed command executes with variant environment and the result includes command output

#### Scenario: Provision with migration command
- **WHEN** config has `variant.up = "bun run migrate"`
- **THEN** provision runs that command before the seed command

### Requirement: variant_up tool

The system SHALL expose a `variant_up` MCP tool accepting an optional slug and an optional `verbose` flag that runs `up` for that variant and returns the slug, mode, worktree, database target and the port, URL and container name of each instance.

#### Scenario: Up a variant

- **WHEN** an MCP client calls `variant_up({ slug: "test-feature" })` and the variant has a containerized instance
- **THEN** the instance container is started and the result includes its port and URL

### Requirement: variant_watch tool

The system SHALL expose a `variant_watch` MCP tool accepting an optional slug that runs `watch` detached, because a tool call cannot stay attached to a console. The result SHALL include the slug, worktree and, per instance, the pid, port and URL.

#### Scenario: Watch returns

- **WHEN** an MCP client calls `variant_watch({ slug: "test-feature" })`
- **THEN** the call returns while the instance processes keep running, and the result lists their pids

### Requirement: variant_down tool

The system SHALL expose a `variant_down` MCP tool accepting an optional slug that stops the runtime of the variant and keeps its data.

#### Scenario: Down a variant

- **WHEN** an MCP client calls `variant_down({ slug: "test-feature" })`
- **THEN** the processes and containers of the variant are stopped and the result lists what was stopped

### Requirement: variant_implode tool

The system SHALL expose a `variant_implode` MCP tool accepting an optional slug and an optional `force` flag that implodes the variant (see the implode capability) and returns the implode report and the removed worktree path. The tool `variant_destroy` SHALL NOT exist.

#### Scenario: Implode a merged variant

- **WHEN** an MCP client calls `variant_implode({ slug: "test-feature" })` for a merged variant
- **THEN** the variant is dropped, state is cleared, the worktree is removed, and the result names it

#### Scenario: Unmerged refused

- **WHEN** an MCP client calls `variant_implode({ slug: "test-feature" })` for an unmerged variant without `force`
- **THEN** the tool returns an error that names `force`

#### Scenario: Destroy tool is gone

- **WHEN** an MCP client lists tools
- **THEN** the result has no `variant_destroy` tool

### Requirement: variant_status tool

The system SHALL expose a `variant_status` MCP tool accepting an optional slug that returns the status of that single variant as JSON: the facts `list` returns for it, including `uptimeSeconds` and `log`, and a `runtime` object with the meta information of its runtime state (see the status capability), with database passwords redacted. An unknown slug SHALL produce an error result naming the slug.

#### Scenario: Status of a variant

- **WHEN** an MCP client calls `variant_status({ slug: "test-feature" })` for a variant with a runtime state
- **THEN** the result is JSON with `slug` `test-feature`, its `mode`, and a `runtime` object with its instances

#### Scenario: Unknown slug

- **WHEN** an MCP client calls `variant_status({ slug: "ghost" })` and `ghost` is unknown
- **THEN** the result is an error that names `ghost`
