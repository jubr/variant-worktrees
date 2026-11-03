## MODIFIED Requirements

### Requirement: variant_provision tool

The system SHALL expose a `variant_provision` MCP tool that runs the configured seed command for a variant.

#### Scenario: Provision with seed
- **WHEN** an MCP client calls `variant_provision({ slug: "test-feature" })` and `variants.yaml` defines a seed command
- **THEN** the seed command executes with variant environment and the result includes command output

#### Scenario: Provision with migration command
- **WHEN** a watch has `up = "bun run migrate"`
- **THEN** provision runs that command before the seed command

### Requirement: variant_up tool

The system SHALL expose a `variant_up` MCP tool accepting an optional slug and an optional `verbose` flag that runs `up` for that variant and returns the slug, mode, worktree, database target and the port, URL and container name of each watch.

#### Scenario: Up a variant

- **WHEN** an MCP client calls `variant_up({ slug: "test-feature" })` and the variant has a containerized watch
- **THEN** the watch container is started and the result includes its port and URL

### Requirement: variant_watch tool

The system SHALL expose a `variant_watch` MCP tool accepting an optional slug that runs `watch` detached, because a tool call cannot stay attached to a console. The result SHALL include the slug, worktree and, per watch, the pid, port and URL.

#### Scenario: Watch returns

- **WHEN** an MCP client calls `variant_watch({ slug: "test-feature" })`
- **THEN** the call returns while the watch processes keep running, and the result lists their pids

### Requirement: variant_status tool

The system SHALL expose a `variant_status` MCP tool accepting an optional slug that returns the status of that single variant as JSON: the facts `list` returns for it, including `uptimeSeconds` and `log`, and a `runtime` object with the meta information of its runtime state (see the status capability), with database passwords redacted. An unknown slug SHALL produce an error result naming the slug.

#### Scenario: Status of a variant

- **WHEN** an MCP client calls `variant_status({ slug: "test-feature" })` for a variant with a runtime state
- **THEN** the result is JSON with `slug` `test-feature`, its `mode`, and a `runtime` object with its watches

#### Scenario: Unknown slug

- **WHEN** an MCP client calls `variant_status({ slug: "ghost" })` and `ghost` is unknown
- **THEN** the result is an error that names `ghost`
