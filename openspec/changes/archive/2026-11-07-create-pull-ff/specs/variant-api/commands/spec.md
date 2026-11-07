## ADDED Requirements

### Requirement: Start-branch fast-forward flag

The commands `create`, `provision`, `up`, and `watch` SHALL accept an optional boolean `pullFf`. No other command SHALL take `pullFf`. The CLI, the MCP server, and the webview forms SHALL derive the flag, tool input, and field from that definition. The CLI flag SHALL be `--pull-ff` and SHALL have no short flag. When the flag is omitted, `execute()` SHALL NOT receive `pullFf`.

#### Scenario: Create pull-ff flag

- **WHEN** a user runs `variant create --pull-ff --slug demo`
- **THEN** `execute()` receives `{ slug: "demo", pullFf: true }`

#### Scenario: Implied commands take pull-ff

- **WHEN** a user runs `variant watch --pull-ff --slug demo`, `variant up --pull-ff --slug demo`, or `variant provision --pull-ff --slug demo`
- **THEN** `execute()` receives `{ slug: "demo", pullFf: true }` plus that command's other flags

#### Scenario: Pull-ff on help

- **WHEN** a user runs `variant create --help`, `variant provision --help`, `variant up --help`, or `variant watch --help`
- **THEN** the help text lists `--pull-ff`
- **AND** the help text lists no short flag for it

#### Scenario: Other commands reject pull-ff

- **WHEN** a user runs `variant down --pull-ff` or `variant implode --pull-ff`
- **THEN** the CLI rejects the unknown flag

#### Scenario: Omitted pull-ff

- **WHEN** a user runs `variant create --slug demo`
- **THEN** `execute()` receives `{ slug: "demo" }`
- **AND** the arguments do not include `pullFf`
