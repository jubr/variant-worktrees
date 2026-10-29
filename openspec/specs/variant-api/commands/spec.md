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

#### Scenario: No arguments show help
- **WHEN** a user runs `variant` without arguments
- **THEN** the CLI produces the same top-level command help as `variant --help`

#### Scenario: Arg parsing
- **WHEN** a user runs `variant create --slug test-feature`
- **THEN** `execute()` receives `{ slug: "test-feature" }`

### Requirement: CLI reports the package version

The `variant` CLI SHALL report the `version` of the `variant-api` package, not a fixed number. `variant --version` SHALL print that version alone, and the first line of `variant --help` SHALL be `variant v` followed by it. This SHALL hold when the CLI runs from source, from the built `dist/`, and from the compiled single-file executable.

#### Scenario: Version flag
- **WHEN** a user runs `variant --version`
- **THEN** the output is the `version` in the `variant-api` `package.json`

#### Scenario: Help header
- **WHEN** a user runs `variant --help`
- **THEN** the first line is `variant v` followed by the `version` in the `variant-api` `package.json`

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

### Requirement: Lifecycle commands execute in variant-api

The system SHALL execute `config`, `create`, `list`, `provision`, `up`, `down`, `watch` and `implode` in `variant-api`. The CLI and the MCP server SHALL call that logic in-process. Those commands SHALL NOT be routed to the VS Code extension. Requests that need the editor are the only socket traffic, and they are not these commands.

#### Scenario: CLI create stays in variant-api

- **WHEN** a user runs `variant create --slug test-feature`
- **THEN** `variant-api` performs the create
- **AND** the extension socket receives no request

#### Scenario: MCP list stays in variant-api

- **WHEN** an MCP client calls `variant_list`
- **THEN** `variant-api` performs the list in the MCP process
- **AND** the extension socket receives no request

#### Scenario: CLI watch stays in variant-api

- **WHEN** a user runs `variant watch --slug test-feature`
- **THEN** `variant-api` supervises the processes in the CLI process
- **AND** the extension socket receives no request

### Requirement: Runtime lifecycle commands

The system SHALL define the commands `up`, `down`, `watch` and `implode` next to `config`, `create`, `list` and `provision`, each with the optional `slug` argument. The commands `destroy` and `switch` SHALL NOT exist; `implode` replaces `destroy`. `watch` SHALL also take a boolean `detach`, and `implode` a boolean `force`. Every command SHALL also accept a boolean `verbose` that restores the full output of quiet provisioning steps. The CLI, the MCP server and the webview forms SHALL derive their flags, tool inputs and fields from these definitions.

#### Scenario: Commands registered

- **WHEN** the CLI lists its commands
- **THEN** `up`, `down`, `watch` and `implode` appear with their descriptions

#### Scenario: Watch detach flag

- **WHEN** a user runs `variant watch --detach --slug demo`
- **THEN** `execute()` receives `{ slug: "demo", detach: true }`

#### Scenario: Implode force flag

- **WHEN** a user runs `variant implode --force demo`
- **THEN** `execute()` receives `{ slug: "demo", force: true }`

#### Scenario: Destroy replaced

- **WHEN** a user runs `variant destroy`
- **THEN** the CLI reports an unknown command and `variant --help` lists `implode`

#### Scenario: Switch removed

- **WHEN** a user runs `variant switch`
- **THEN** the CLI reports an unknown command and `variant --help` does not list `switch`
- **AND** the MCP server registers no `variant_switch` tool

#### Scenario: Verbose flag

- **WHEN** a user runs `variant provision --verbose`
- **THEN** `execute()` receives `{ verbose: true }`

### Requirement: List table view

The system SHALL print `variant list --table` as a text table with the columns `slug`, `dir`, `url` and `schema`, one row per variant sorted by slug, with `-` for a missing value and the directory shown relative to the variant root. Without `--table` the command SHALL print the JSON result as before.

#### Scenario: Table output

- **WHEN** variants `alpha` (with a directory, URL and schema) and `beta` (database only) exist and a user runs `variant list --table`
- **THEN** stdout holds a header row and two rows in that order, and `beta` shows `-` for directory and URL

#### Scenario: JSON stays the default

- **WHEN** a user runs `variant list`
- **THEN** stdout is the JSON array of records
