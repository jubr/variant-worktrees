## ADDED Requirements

### Requirement: Runtime lifecycle commands

The system SHALL define the commands `up`, `down`, `watch` and `implode` next to `config`, `create`, `list`, `switch` and `provision`, each with the optional `slug` argument. The command `destroy` SHALL NOT exist; `implode` replaces it. `watch` SHALL also take a boolean `detach`, and `implode` a boolean `force`. Every command SHALL also accept a boolean `verbose` that restores the full output of quiet provisioning steps. The CLI, the MCP server and the webview forms SHALL derive their flags, tool inputs and fields from these definitions.

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

## MODIFIED Requirements

### Requirement: Lifecycle commands execute in variant-api

The system SHALL execute `config`, `create`, `list`, `switch`, `provision`, `up`, `down`, `watch` and `implode` in `variant-api`. The CLI and the MCP server SHALL call that logic in-process. Those commands SHALL NOT be routed to the VS Code extension. Requests that need the editor are the only socket traffic, and they are not these commands.

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
