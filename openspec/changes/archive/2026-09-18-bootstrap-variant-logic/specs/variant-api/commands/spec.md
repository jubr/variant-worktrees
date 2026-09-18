## Purpose

Declarative command definitions for CLI, MCP, and VS Code webview UI generation, ported from docs/cli-vscode-webview.md pattern.

## ADDED Requirements

### Requirement: CommandDefinition schema

The system SHALL define commands as typed objects with name, description, args, execute function.

#### Scenario: Valid command definition
- **WHEN** command is registered
- **THEN** object has `name: keyof VariantClient`, `description: string`, `args: ArgDefinition[]`, `execute: (client, args) => Promise<unknown>`

#### Scenario: ArgDefinition structure
- **WHEN** command declares arg
- **THEN** arg has `name: string`, `description: string`, `type: "string" | "number" | "boolean"`, `required: boolean`

### Requirement: CLI routing from commands

The system SHALL auto-generate cleye CLI routing from `commands[]` array.

#### Scenario: CLI discovers commands
- **WHEN** CLI boots
- **THEN** each `commands[i]` becomes a cleye subcommand

#### Scenario: Arg parsing
- **WHEN** user runs `variant create --slug test-feature`
- **THEN** `execute()` receives `{ slug: "test-feature" }`

### Requirement: MCP tool generation

The system SHALL expose each command as MCP tool with auto-generated schema.

#### Scenario: MCP tool list
- **WHEN** MCP server lists tools
- **THEN** result includes tool per command with name, description, inputSchema from args

### Requirement: VS Code webview form generation

The system SHALL auto-generate webview forms from `ArgDefinition[]`.

#### Scenario: Render input fields
- **WHEN** VS Code command opens webview
- **THEN** form has `vscode-text-field` per arg with label from description

#### Scenario: Required field validation
- **WHEN** arg.required is true
- **THEN** field has `required` attribute
