## MODIFIED Requirements

### Requirement: Runtime lifecycle commands

The system SHALL define the commands `up`, `down`, `watch` and `implode` next to `config`, `create`, `list` and `provision`, each with the optional `slug` argument. The commands `destroy` and `switch` SHALL NOT exist; `implode` replaces `destroy`. `watch` SHALL also take a boolean `detach`, and `implode` a boolean `force`. `create`, `provision`, `up` and `watch` SHALL also take an optional string `from`, a git commit-ish that names the start of a newly created variant branch. No other command SHALL take `from`. Every command SHALL also accept a boolean `verbose` that restores the full output of quiet provisioning steps. The CLI, the MCP server and the webview forms SHALL derive their flags, tool inputs and fields from these definitions. The CLI flag SHALL be `--from` and SHALL have no short flag.

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

#### Scenario: Create from flag

- **WHEN** a user runs `variant create --from feat/other --slug demo`
- **THEN** `execute()` receives `{ slug: "demo", from: "feat/other" }`

#### Scenario: Implied commands take from

- **WHEN** a user runs `variant watch --from abc123 --slug demo`, `variant up --from abc123 --slug demo`, or `variant provision --from abc123 --slug demo`
- **THEN** `execute()` receives `{ slug: "demo", from: "abc123" }` plus that command's other flags

#### Scenario: From on help

- **WHEN** a user runs `variant create --help`, `variant provision --help`, `variant up --help`, or `variant watch --help`
- **THEN** the help text lists `--from`

#### Scenario: Other commands reject from

- **WHEN** a user runs `variant down --from abc123` or `variant implode --from abc123`
- **THEN** the CLI rejects the unknown flag
