# variant-api commands Specification

## Purpose

Declarative command definitions expose one consistent lifecycle contract across
the CLI, MCP server, and VS Code webview interfaces.

## Requirements

### Requirement: CommandDefinition schema

The system SHALL define commands as typed objects with name, description, args, and execute function.

#### Scenario: Valid command definition
- **WHEN** a command is registered
- **THEN** the object has `name: keyof VariantClient`, `description: string`, `args: ArgDefinition[]`, and `execute: (client, args) => Promise<unknown>`

#### Scenario: ArgDefinition structure
- **WHEN** a command declares an argument
- **THEN** the argument has `name: string`, `description: string`, `type: "string" | "number" | "boolean"`, and `required: boolean`

### Requirement: CLI routing from commands

The system SHALL auto-generate cleye CLI routing from the `commands[]` array.

#### Scenario: CLI discovers commands
- **WHEN** the CLI boots
- **THEN** each `commands[i]` becomes a cleye subcommand

#### Scenario: Arg parsing
- **WHEN** a user runs `variant create --slug test-feature`
- **THEN** `execute()` receives `{ slug: "test-feature" }`

### Requirement: MCP tool generation

The system SHALL expose each command as an MCP tool with an auto-generated schema.

#### Scenario: MCP tool list
- **WHEN** an MCP client lists tools
- **THEN** the result includes one tool per command with name, description, and inputSchema derived from args

### Requirement: VS Code webview form generation

The system SHALL auto-generate webview forms from `ArgDefinition[]`.

#### Scenario: Render input fields
- **WHEN** a VS Code command opens a webview
- **THEN** the form has one `vscode-text-field` per argument with its label from the description

#### Scenario: Required field validation
- **WHEN** an argument has `required: true`
- **THEN** its field has the `required` attribute
