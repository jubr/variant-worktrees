## ADDED Requirements

### Requirement: Lifecycle commands execute in variant-api

The system SHALL execute `config`, `create`, `destroy`, `list`, `switch`, and `provision` in `variant-api`. The CLI and the MCP server SHALL call that logic in-process. Those commands SHALL NOT be routed to the VS Code extension. Requests that need the editor are the only socket traffic, and they are not these commands.

#### Scenario: CLI create stays in variant-api

- **WHEN** a user runs `variant create --slug test-feature`
- **THEN** `variant-api` performs the create
- **AND** the extension socket receives no request

#### Scenario: MCP list stays in variant-api

- **WHEN** an MCP client calls `variant_list`
- **THEN** `variant-api` performs the list in the MCP process
- **AND** the extension socket receives no request
