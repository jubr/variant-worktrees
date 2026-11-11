## MODIFIED Requirements

### Requirement: List default output

The system SHALL print `variant list` as a text table with the columns `slug`, `mode`, `uptime`, `url`, `log` and `dir`, one row per variant sorted by slug, with `-` for a missing value. `url` SHALL be the complete URL of the first watch that has one, never shortened. `uptime` SHALL be the human-readable `uptimeSeconds` of the variant. `log` SHALL be the absolute path of the log file of its watch when the runtime state records one. `dir` SHALL be shown relative to the variant root. The `--table` flag SHALL NOT exist. `variant list --json` and `--yaml` SHALL print the records instead (see the output-formats capability).

#### Scenario: Table output

- **WHEN** variant `alpha` runs a detached watch for 5 minutes with URL `http://alpha.vw.localhost:62060/` and a log file, variant `beta` has a database only, and a user runs `variant list`
- **THEN** stdout holds a header row and two rows in that order
- **AND** the `alpha` row shows `watch`, `5m`, the full URL, the absolute log path and its directory
- **AND** `beta` shows `-` for mode, uptime, URL, log and directory

#### Scenario: Attached watch log column

- **WHEN** variant `alpha` has an attached watch whose state records `log` as `/work/_v-alpha/.cache/variant/watch.log` and a user runs `variant list`
- **THEN** the `alpha` row shows that absolute path in the log column

#### Scenario: Full URL

- **WHEN** a URL is longer than any other cell of its column
- **THEN** the table shows it complete

#### Scenario: JSON on request

- **WHEN** a user runs `variant list --json`
- **THEN** stdout is the JSON array of records, each with the fields of the minimal set (`slug`, `mode`, `uptimeSeconds`, `url`, `log`, `worktree`)

#### Scenario: Table flag removed

- **WHEN** a user runs `variant list --table`
- **THEN** the CLI reports an unexpected flag and exits non-zero
