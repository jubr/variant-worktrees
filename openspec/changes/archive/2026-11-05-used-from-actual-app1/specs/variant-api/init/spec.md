## MODIFIED Requirements

### Requirement: Init writes autodetected values

`variant init` SHALL write into `variants.yaml` every value that autodetection resolves for the directory: the `db`
settings found in the Mise or process environment ([specs/tools/mise](../../tools/mise/spec.md)) (Postgres, MySQL and MariaDB, which are written as dialect
`mysql`, and SQLite), `variant.abbr`, `variant.prefix`, and one entry of `variant.watches` per detected application
with its `kind`, `watch` and, for Vite, `url` (in the `${...}` syntax); `dir` is written only when it differs from the key of the entry. When no
database is detected it SHALL write only `db.dialect: sqlite`. Machine-specific paths (`variant.main`,
`variant.root`, the default SQLite file) SHALL NOT be written. The written file SHALL pass the same validation as any
`variants.yaml`, and loading it SHALL resolve to the same database and watches as the autodetected ones.

#### Scenario: Postgres from mise

- **WHEN** `mise.local.toml` defines `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_USER`, `POSTGRES_PASSWORD` and
  `POSTGRES_DB` as `appdb`
- **THEN** the file has `db.dialect: postgres`, `host: ${POSTGRES_HOST}`, `port: ${POSTGRES_PORT}`, `user: ${POSTGRES_USER}`, `password: ${POSTGRES_PASSWORD}` and `database: appdb`
- **AND** the file has neither `variant.main` nor `variant.root`
- **AND** the file does not contain the password value

#### Scenario: MariaDB

- **WHEN** the environment defines `MARIADB_HOST` and `MARIADB_DATABASE`
- **THEN** the file has `db.dialect: mysql` with that host and database

#### Scenario: Nothing detected

- **WHEN** no database setting is detected
- **THEN** the file has `db: { dialect: sqlite }` and no `filename`

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

### Requirement: Secrets stay in the environment

`variant init` SHALL NOT write a secret into `variants.yaml`. A `db.password` that autodetection read from an
environment variable (`POSTGRES_PASSWORD`, `MYSQL_PASSWORD`, `MARIADB_PASSWORD`) and a `db.url` read from
`DATABASE_URL` that carries a password SHALL be written as a reference `${NAME}` to that variable. For Postgres, `db.host`, `db.port` and `db.user` that autodetection read from `POSTGRES_HOST`, `POSTGRES_PORT` and `POSTGRES_USER` SHALL also be written as `${NAME}` references, and `db.password` SHALL be written that way whenever `POSTGRES_PASSWORD` is set. `db.database` SHALL be written as the detected name, not as a reference. Each reference
SHALL carry a comment on its line that names where the variable comes from: the path of the mise file that defines it
(its source as specified in [specs/tools/mise](../../tools/mise/spec.md), Variable sources), relative to the `variants.yaml`, such as `# from ../mise.local.toml`, or `# from the
environment` when no file is listed for it. MySQL and MariaDB host, port and user SHALL be written as the detected values. Values that are not secrets and not those Postgres references SHALL be
written as they are.

#### Scenario: Password from mise

- **WHEN** `mise.local.toml` in the parent directory defines `POSTGRES_PASSWORD`
- **THEN** the file has the line `password: ${POSTGRES_PASSWORD} # from ../mise.local.toml` and no value of the
  password

#### Scenario: Postgres connection references

- **WHEN** `mise.local.toml` defines `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_USER` and `POSTGRES_PASSWORD`
- **THEN** the file has `host: ${POSTGRES_HOST}`, `port: ${POSTGRES_PORT}`, `user: ${POSTGRES_USER}` and `password: ${POSTGRES_PASSWORD}`, each with a `# from` comment naming that file

#### Scenario: URL with credentials

- **WHEN** the environment has `DATABASE_URL=postgres://app:secret@localhost/app`
- **THEN** the file has `url: ${DATABASE_URL} # from the environment` and no part of `secret`

#### Scenario: URL without credentials

- **WHEN** `DATABASE_URL` is `postgres://localhost/app`
- **THEN** the file has that URL as it is
