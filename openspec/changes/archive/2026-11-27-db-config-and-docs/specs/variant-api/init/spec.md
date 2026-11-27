## ADDED Requirements

### Requirement: Init writes the detected SQLite file

When the detected database is SQLite, `variant init` SHALL write `db.type: sqlite` and the detected file as `db.database`, exactly as detection resolved it, and SHALL NOT write `db.filename`. A SQLite file that autodetection only defaults, `.cache/variants/${slug}.sqlite`, SHALL NOT be written. The written file SHALL load to the same `db.database` as autodetection without it.

#### Scenario: File from the environment

- **WHEN** `SQLITE_DATABASE` is `./data/app.sqlite`
- **THEN** the file has `db.type: sqlite` and `database: ./data/app.sqlite`
- **AND** the file has no `filename` key
- **AND** loading it resolves `db.database` to the same value as detection without the file

#### Scenario: File from a URL

- **WHEN** `DATABASE_URL` is `sqlite:///var/data/app.sqlite`
- **THEN** the file has `db.type: sqlite` and `database: /var/data/app.sqlite`

#### Scenario: Default file not pinned

- **WHEN** no database setting is detected
- **THEN** the file has no `db` key

## MODIFIED Requirements

### Requirement: Init writes autodetected values

`variant init` SHALL write into `variants.yaml` every value that autodetection resolves for the directory: the `db`
settings found in the Mise or process environment ([specs/tools/mise](../../tools/mise/spec.md)) (Postgres, MySQL and MariaDB, which are written as type
`mysql`, and SQLite), `variant.abbr`, `variant.prefix`, and one entry of `variant.watches` per detected application
with its `kind`, `watch` and, for Vite, `url` (in the `${...}` syntax); the host, port, user, password and database of a server type that the environment gives under the variable names of that type (`POSTGRES_*`, `MYSQL_*`, `MARIADB_*`) are written as references to those variables, and a MySQL database as `${NAME}__${schema}`; `dir` is written only when it differs from the key of the entry. When no
database setting is detected it SHALL write no `db` key at all, so the file leaves the choice to autodetection. Machine-specific paths (`variant.main`,
`variant.root`, the default SQLite file) SHALL NOT be written. The file SHALL begin with the schema header of
[specs/variant-config/core | Schema header](../../variant-config/core/spec.md#requirement-schema-header) followed by a blank line, so a
`variant` command or the extension that loads it afterwards finds nothing to migrate and writes no `variants.yaml~`.
The written file SHALL pass the same validation as any
`variants.yaml`, and loading it SHALL resolve to the same database and watches as the autodetected ones.

#### Scenario: Postgres from mise

- **WHEN** `mise.local.toml` defines `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_USER`, `POSTGRES_PASSWORD` and
  `POSTGRES_DB` as `appdb`
- **THEN** the file has `db.type: postgres`, `host: ${POSTGRES_HOST}`, `port: ${POSTGRES_PORT}`, `user: ${POSTGRES_USER}`, `password: ${POSTGRES_PASSWORD}` and `database: ${POSTGRES_DB}`
- **AND** the file has neither `variant.main` nor `variant.root`
- **AND** the file does not contain the password value

#### Scenario: MariaDB

- **WHEN** the environment defines `MARIADB_HOST` and `MARIADB_DATABASE`
- **THEN** the file has `db.type: mysql`, `host: ${MARIADB_HOST}` and `database: ${MARIADB_DATABASE}__${schema}`

#### Scenario: MySQL database per variant

- **WHEN** the environment defines `MYSQL_HOST`, `MYSQL_USER` and `MYSQL_DATABASE` as `shop`
- **THEN** the file has `db.type: mysql`, `host: ${MYSQL_HOST}`, `user: ${MYSQL_USER}` and `database: ${MYSQL_DATABASE}__${schema}`, so each variant gets its own database named from `shop`

#### Scenario: Nothing detected

- **WHEN** no database setting is detected
- **THEN** the file has no `db` key
- **AND** loading it resolves to the same SQLite database as autodetection without a file

#### Scenario: Schema header first

- **WHEN** init writes `variants.yaml`
- **THEN** its first line is the `yaml-language-server` modeline of the main schema and its second line is blank
- **AND** the "Written by `variant init`" comment follows

#### Scenario: Nothing to migrate afterwards

- **WHEN** init has written `variants.yaml` and a person runs `variant list` in that directory
- **THEN** the command prints no migration message and `variants.yaml~` does not exist

#### Scenario: Watches

- **WHEN** a Vite app in `fe` and a NestJS app in `be` exist
- **THEN** the file has watches `be` and `fe` with their `kind` and autodetected `watch`, `fe` has `url`, and neither
  has `dir`

#### Scenario: Directory differs from the key

- **WHEN** apps exist in `a/web` and `b/web`
- **THEN** the watches are `web` and `web-2` and each has its `dir`

#### Scenario: Round trip

- **WHEN** the written file is loaded
- **THEN** validation passes and the resolved database equals the autodetected one

#### Scenario: Main and root stay resolved

- **WHEN** the written file omits `variant.main` and `variant.root` and a person runs `variant config` in that directory
- **THEN** the printed configuration includes the resolved `variant.main` and `variant.root`
