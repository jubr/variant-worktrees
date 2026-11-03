## MODIFIED Requirements

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
