# variant-mcp tools Specification

## Purpose

The MCP server exposes database variant lifecycle operations to agents and
other MCP clients through stable, typed tools.

## Requirements

### Requirement: variant_list tool

The system SHALL expose a `variant_list` MCP tool returning variant inventory.

#### Scenario: List variants
- **WHEN** an MCP client calls `variant_list` with no args
- **THEN** the result is an array of objects with slug, schema or database, state, and worktree

### Requirement: variant_create tool

The system SHALL expose a `variant_create` MCP tool accepting a slug argument.

#### Scenario: Create variant
- **WHEN** an MCP client calls `variant_create({ slug: "test-feature" })`
- **THEN** a variant schema or database is created, a worktree is ensured, and the result includes the state path

### Requirement: variant_destroy tool

The system SHALL expose a `variant_destroy` MCP tool accepting a slug argument.

#### Scenario: Destroy variant
- **WHEN** an MCP client calls `variant_destroy({ slug: "test-feature" })`
- **THEN** the variant is dropped, state is cleared, and the result confirms removal

### Requirement: variant_switch tool

The system SHALL expose a `variant_switch` MCP tool that changes process context to a variant worktree.

#### Scenario: Switch to variant
- **WHEN** an MCP client calls `variant_switch({ slug: "test-feature" })`
- **THEN** cwd changes to the resolved `_v-test-feature` worktree and the result includes its path

### Requirement: variant_provision tool

The system SHALL expose a `variant_provision` MCP tool that runs the configured seed command for a variant.

#### Scenario: Provision with seed
- **WHEN** an MCP client calls `variant_provision({ slug: "test-feature" })` and `variants.yaml` defines a seed command
- **THEN** the seed command executes with variant environment and the result includes command output

#### Scenario: Provision with migration command
- **WHEN** config has `variant.up = "bun run migrate"`
- **THEN** provision runs that command before the seed command
