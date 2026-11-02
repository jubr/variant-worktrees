## MODIFIED Requirements

### Requirement: variant_list tool

The system SHALL expose a `variant_list` MCP tool returning variant inventory. It SHALL accept an optional `verbose` flag; with it every item carries all meta information that `variant_status` returns, including the `runtime` object.

#### Scenario: List variants
- **WHEN** an MCP client calls `variant_list` with no args
- **THEN** the result is an array of objects with slug, schema or database, state, and worktree, plus mode, uptime and log file where known

#### Scenario: Verbose list
- **WHEN** an MCP client calls `variant_list({ verbose: true })`
- **THEN** each item equals the result of `variant_status` for its slug

## ADDED Requirements

### Requirement: variant_status tool

The system SHALL expose a `variant_status` MCP tool accepting an optional slug that returns the status of that single variant as JSON: the facts `list` returns for it, including `uptimeSeconds` and `log`, and a `runtime` object with the meta information of its runtime state (see the status capability), with database passwords redacted. An unknown slug SHALL produce an error result naming the slug.

#### Scenario: Status of a variant

- **WHEN** an MCP client calls `variant_status({ slug: "test-feature" })` for a variant with a runtime state
- **THEN** the result is JSON with `slug` `test-feature`, its `mode`, and a `runtime` object with its instances

#### Scenario: Unknown slug

- **WHEN** an MCP client calls `variant_status({ slug: "ghost" })` and `ghost` is unknown
- **THEN** the result is an error that names `ghost`
