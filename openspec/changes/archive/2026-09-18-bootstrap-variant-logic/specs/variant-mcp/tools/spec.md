## Purpose

MCP tool surface for variant lifecycle operations: list, create, destroy, switch, provision.

## ADDED Requirements

### Requirement: variant_list tool

The system SHALL expose `variant_list` MCP tool returning variant inventory.

#### Scenario: List variants
- **WHEN** MCP client calls `variant_list` with no args
- **THEN** result is array of objects with slug, schema, state, worktree

### Requirement: variant_create tool

The system SHALL expose `variant_create` MCP tool accepting slug arg.

#### Scenario: Create variant
- **WHEN** MCP client calls `variant_create({ slug: "test-feature" })`
- **THEN** variant schema created, worktree ensured, result includes state path

### Requirement: variant_destroy tool

The system SHALL expose `variant_destroy` MCP tool accepting slug arg.

#### Scenario: Destroy variant
- **WHEN** MCP client calls `variant_destroy({ slug: "test-feature" })`
- **THEN** schema dropped, state cleared, result confirms removal

### Requirement: variant_switch tool

The system SHALL expose `variant_switch` MCP tool that cds to variant worktree.

#### Scenario: Switch to variant
- **WHEN** MCP client calls `variant_switch({ slug: "test-feature" })`
- **THEN** cwd changes to `_v-test-feature` worktree, result includes new path

### Requirement: variant_provision tool

The system SHALL expose `variant_provision` MCP tool that runs seed command for variant.

#### Scenario: Provision with seed
- **WHEN** MCP client calls `variant_provision({ slug: "test-feature" })` and `variants.yaml` defines `seed` command
- **THEN** seed command executes with variant env, result includes command output

#### Scenario: Provision with migration detection
- **WHEN** config has `variant.up = "bun run migrate"`
- **THEN** provision runs that command before seed
