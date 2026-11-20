## MODIFIED Requirements

### Requirement: Extension README is user-facing

The `variant-vscode` package README SHALL NOT contain development information: no `bun install`, `bun run`, `bun test`, `task `, `F5`, or `Extension Development Host`, and no Development heading. It SHALL describe the CLI, `variants.yaml` configuration, the MCP server (started with `variant mcp`), and the chat renamer.

#### Scenario: No development information

- **WHEN** the `variant-vscode` package README is read
- **THEN** it contains none of `bun install`, `bun run`, `bun test`, `F5`, or `Extension Development Host`
- **AND** it has no heading named Development

#### Scenario: Product areas present

- **WHEN** the `variant-vscode` package README is read
- **THEN** it mentions `variants.yaml`, `variant mcp`, and `/chat-rename`
- **AND** it does not name a command `variant-mcp`
