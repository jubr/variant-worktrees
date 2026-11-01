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

The system SHALL print `variant list` as a text table with the columns `slug`, `dir`, `url` and `schema`, one row per variant sorted by slug, with `-` for a missing value and the directory shown relative to the variant root. The `--table` flag SHALL NOT exist. `variant list --json` and `--yaml` SHALL print the records instead (see the output-formats capability).

#### Scenario: Table output

- **WHEN** variants `alpha` (with a directory, URL and schema) and `beta` (database only) exist and a user runs `variant list`
- **THEN** stdout holds a header row and two rows in that order, and `beta` shows `-` for directory and URL

#### Scenario: JSON on request

- **WHEN** a user runs `variant list --json`
- **THEN** stdout is the JSON array of records

#### Scenario: Table flag removed

- **WHEN** a user runs `variant list --table`
- **THEN** the CLI reports an unexpected flag and exits non-zero
