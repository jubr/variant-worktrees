## ADDED Requirements

### Requirement: variant_status tool

The system SHALL expose a `variant_status` MCP tool accepting an optional slug that returns the status of that single variant as JSON: the facts `list` returns for it and a `runtime` object with the meta information of its runtime state (see the status capability), with database passwords redacted. An unknown slug SHALL produce an error result naming the slug.

#### Scenario: Status of a variant

- **WHEN** an MCP client calls `variant_status({ slug: "test-feature" })` for a variant with a runtime state
- **THEN** the result is JSON with `slug` `test-feature`, its `mode`, and a `runtime` object with its instances

#### Scenario: Unknown slug

- **WHEN** an MCP client calls `variant_status({ slug: "ghost" })` and `ghost` is unknown
- **THEN** the result is an error that names `ghost`
