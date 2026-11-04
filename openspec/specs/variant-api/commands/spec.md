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

The `variant` CLI SHALL report the `version` of the `variant-cli` package, not a fixed number. `variant --version` SHALL print that version alone, and the first line of `variant --help` SHALL be `variant v` followed by it. This SHALL hold when the CLI runs from source, from the built `dist/`, and from the compiled single-file executable.

#### Scenario: Version flag
- **WHEN** a user runs `variant --version`
- **THEN** the output is the `version` in the `variant-cli` `package.json`

#### Scenario: Help header
- **WHEN** a user runs `variant --help`
- **THEN** the first line is `variant v` followed by the `version` in the `variant-cli` `package.json`

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

The system SHALL execute `config`, `create`, `list`, `status`, `provision`, `up`, `down`, `watch` and `implode` in `variant-api`. The CLI and the MCP server SHALL call that logic in-process. Those commands SHALL NOT be routed to the VS Code extension. Requests that need the editor are the only socket traffic, and they are not these commands.

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

#### Scenario: CLI status stays in variant-api

- **WHEN** a user runs `variant status test-feature`
- **THEN** `variant-api` reads the status in the CLI process
- **AND** the extension socket receives no request

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

### Requirement: List default output

The system SHALL print `variant list` as a text table with the columns `slug`, `mode`, `uptime`, `url`, `log` and `dir`, one row per variant sorted by slug, with `-` for a missing value. `url` SHALL be the complete URL of the first watch that has one, never shortened. `uptime` SHALL be the human-readable `uptimeSeconds` of the variant. `log` SHALL be the absolute path of the log file of its detached watch. `dir` SHALL be shown relative to the variant root. The `--table` flag SHALL NOT exist. `variant list --json` and `--yaml` SHALL print the records instead (see the output-formats capability).

#### Scenario: Table output

- **WHEN** variant `alpha` runs a detached watch for 5 minutes with URL `http://alpha.vw.localhost:62060/` and a log file, variant `beta` has a database only, and a user runs `variant list`
- **THEN** stdout holds a header row and two rows in that order
- **AND** the `alpha` row shows `watch`, `5m`, the full URL, the absolute log path and its directory
- **AND** `beta` shows `-` for mode, uptime, URL, log and directory

#### Scenario: Full URL

- **WHEN** a URL is longer than any other cell of its column
- **THEN** the table shows it complete

#### Scenario: JSON on request

- **WHEN** a user runs `variant list --json`
- **THEN** stdout is the JSON array of records, each with the fields of the minimal set (`slug`, `mode`, `uptimeSeconds`, `url`, `log`, `worktree`)

#### Scenario: Table flag removed

- **WHEN** a user runs `variant list --table`
- **THEN** the CLI reports an unexpected flag and exits non-zero

### Requirement: Verbose list

`variant list` SHALL accept the boolean `verbose` argument. With it, every record SHALL carry all the meta information that `status` returns for that variant (including the `runtime` object, with passwords redacted), and the text output SHALL print each variant as the `status` text does, separated by a blank line, instead of the table. The result for each variant SHALL equal the result of `status` for its slug.

#### Scenario: Verbose records equal status

- **WHEN** variants `alpha` and `beta` exist and a user runs `variant list --verbose --json`
- **THEN** the array holds two records, each equal to the output of `variant status <slug> --json`

#### Scenario: Verbose text

- **WHEN** a user runs `variant list -v` and `alpha` has a runtime state with database settings
- **THEN** stdout shows the database settings and each watch's port, pid and URL of `alpha` the same way `variant status alpha` does

#### Scenario: Minimal by default

- **WHEN** a user runs `variant list --json` without `verbose`
- **THEN** the records have no `runtime` object

### Requirement: Short verbose flag

The CLI SHALL accept `-v` as the short form of `--verbose` on every command that has `--verbose`. `--version` SHALL remain the only way to print the version.

#### Scenario: Short flag

- **WHEN** a user runs `variant list -v`
- **THEN** `execute()` receives `{ verbose: true }`

#### Scenario: Version unaffected

- **WHEN** a user runs `variant --version`
- **THEN** the output is the version and not a verbose listing
