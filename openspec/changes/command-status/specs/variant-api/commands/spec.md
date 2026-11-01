## MODIFIED Requirements

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

## REMOVED Requirements

### Requirement: List table view

**Reason**: The table becomes the default text output of `variant list`, so the opt-in `--table` flag and the JSON default no longer exist.
**Migration**: Run `variant list` for the table and `variant list --json` for the JSON array.

## ADDED Requirements

### Requirement: List default output

The system SHALL print `variant list` as a text table with the columns `slug`, `mode`, `uptime`, `url`, `log` and `dir`, one row per variant sorted by slug, with `-` for a missing value. `url` SHALL be the complete URL of the first instance that has one, never shortened. `uptime` SHALL be the human-readable `uptimeSeconds` of the variant. `log` SHALL be the absolute path of the log file of its detached watch. `dir` SHALL be shown relative to the variant root. The `--table` flag SHALL NOT exist. `variant list --json` and `--yaml` SHALL print the records instead (see the output-formats capability).

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
- **THEN** stdout shows the database settings and each instance's port, pid and URL of `alpha` the same way `variant status alpha` does

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
