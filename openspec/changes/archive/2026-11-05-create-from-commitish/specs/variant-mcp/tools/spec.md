## MODIFIED Requirements

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
