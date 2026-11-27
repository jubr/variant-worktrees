## Purpose

Defines how the text output of `variant create`, `variant status` and `variant list` shows where a variant lives and where its data is, so a person sees both without reading the state file.

## ADDED Requirements

### Requirement: Variant text shows worktree and database

The text output of `variant create` SHALL be the line `Created <slug>`, then the lines `worktree:` and `database:` with their values aligned, in this order. The text of `variant status` SHALL start with the slug and show the same two lines in place of the former `target:`, `dialect:` and `worktree:` lines, before `mode`, `uptime`, `url` and `log`. `database` is the `database` of the variant record: for SQLite the file as `db.database` names it for the slug, so a relative `db.database` is shown relative to the worktree (`.cache/variants/demo.sqlite`) and an absolute one is shown absolute; for PostgreSQL and MySQL the connection as `postgres://` or `mysql://` with the password shown as `***`. For PostgreSQL and MySQL a `schema:` line with the target, aligned the same way, SHALL follow `database:`. These outputs SHALL NOT have `target:` or `dialect:` lines. The table of `variant list` SHALL end with the column `database`, holding the `database` of each record or `-`, and `variant list --verbose` SHALL print each variant as the `status` text does. `--json` and `--yaml` SHALL print the record, which keeps `database`, `target` and `dialect`.

#### Scenario: SQLite create

- **WHEN** a person runs `variant create -s demo` in a SQLite project with no `db.database`
- **THEN** stdout is `Created demo`, then `worktree:  <absolute path>/_v-demo`, then `database:  .cache/variants/demo.sqlite`

#### Scenario: Absolute SQLite file

- **WHEN** `db.database` is `/srv/db/${slug}.sqlite` and a person runs `variant create -s demo`
- **THEN** the `database:` line is `database:  /srv/db/demo.sqlite`

#### Scenario: PostgreSQL create

- **WHEN** a person runs `variant create -s demo` and the database is `app` on `db.example` with user `app` and password `secret`
- **THEN** the `database:` line is `postgres://app:***@db.example:5432/app`, a `schema:` line shows `v_demo`, and stdout does not contain `secret`

#### Scenario: Status

- **WHEN** a person runs `variant status -s demo` for a SQLite variant
- **THEN** stdout starts with `demo`, then `worktree:` and `database:` lines, and has no `target:` or `dialect:` line

#### Scenario: List table

- **WHEN** a person runs `variant list` for a SQLite project with the variants `alpha` and `beta`
- **THEN** the header row ends with `database` and each row ends with that variant's `.cache/variants/<slug>.sqlite`

#### Scenario: Structured output

- **WHEN** a person runs `variant create -s demo --json`
- **THEN** the JSON has `database`, `target` and `dialect`
