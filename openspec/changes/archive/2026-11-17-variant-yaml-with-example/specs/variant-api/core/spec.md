## ADDED Requirements

### Requirement: No empty state directory

The system SHALL NOT create `.cache/variants/` as a side effect of running a command. A command SHALL create that directory only when it writes a file into it: a SQLite variant database whose location is the default, or a legacy state file. A command that creates nothing there, such as `watch`, `list` or `status` on a PostgreSQL project, SHALL leave the directory absent, and an existing directory SHALL be left as it is.

#### Scenario: Watch on a project without SQLite files

- **WHEN** `watch` or `list` runs in a project whose connection is not a default-location SQLite database and `.cache/variants/` does not exist
- **THEN** `.cache/variants/` still does not exist afterwards

#### Scenario: SQLite database in the default location

- **WHEN** `provision` creates a variant database for a SQLite connection without `db.filename`
- **THEN** the file `.cache/variants/<slug>.db` exists, so the directory exists

#### Scenario: Existing directory untouched

- **WHEN** `.cache/variants/` holds `old.yaml` and any command runs
- **THEN** `old.yaml` is still there and still read as a legacy state
