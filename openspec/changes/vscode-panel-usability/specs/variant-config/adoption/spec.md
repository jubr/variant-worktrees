## Purpose

Reports whether a directory already uses Variant or only looks ready for it, so the editor and the onboarding notification share one result.

## ADDED Requirements

### Requirement: Adoption of a directory

The configuration library SHALL report adoption of a directory as exactly one of `active`, `detected`, or `none`. This operation SHALL be the only onboarding detection the package exports. `active` SHALL mean a `variants.yaml` or `variants.yml` is found by walking that directory and its parents, checking `variants.yaml` before `variants.yml` in each directory, the same lookup the other commands use to load configuration. When the result is `active`, the environment SHALL NOT be read. Otherwise the same operation SHALL detect a database and applications in that directory. When both are found, the result SHALL be `detected` and SHALL carry that label: the database and the distinct application kinds joined by `+`, kinds in the order `vite`, `nestjs`, `package-script-watch`. The database name SHALL be `postgres`, `mysql`, `mariadb`, or `sqlite`; a database detected through MariaDB SHALL be named `mariadb`. The SQLite fallback used when nothing is detected SHALL NOT count as a database. When there is no label, the result SHALL be `none`. When reading the environment fails, the result SHALL be `none` and SHALL carry that failure for the caller.

#### Scenario: Config file in the directory

- **WHEN** the directory contains `variants.yaml`
- **THEN** adoption is `active` and the environment is not read

#### Scenario: YAML sibling name

- **WHEN** the directory contains `variants.yml` and no `variants.yaml`
- **THEN** adoption is `active`

#### Scenario: Config file in a parent

- **WHEN** the directory has no config file and a parent directory contains `variants.yaml`
- **THEN** adoption is `active`

#### Scenario: Postgres and Vite

- **WHEN** no config file is found, the environment defines `POSTGRES_HOST`, and a Vite app exists
- **THEN** adoption is `detected` with label `postgres+vite`

#### Scenario: SQLite and a watch script

- **WHEN** no config file is found, `SQLITE_DATABASE` is set, and the only application is a package with a watch script
- **THEN** adoption is `detected` with label `sqlite+package-script-watch`

#### Scenario: MariaDB and NestJS

- **WHEN** no config file is found, `MARIADB_HOST` is set, and a NestJS app exists
- **THEN** adoption is `detected` with label `mariadb+nestjs`

#### Scenario: MySQL and Vite

- **WHEN** no config file is found, `MYSQL_HOST` is set, and a Vite app exists
- **THEN** adoption is `detected` with label `mysql+vite`

#### Scenario: Several application kinds

- **WHEN** no config file is found and Vite, NestJS, and a package watch script are all present along with Postgres
- **THEN** the label is `postgres+vite+nestjs+package-script-watch`

#### Scenario: Nothing to detect

- **WHEN** no config file is found and either no database or no application is detected
- **THEN** adoption is `none`

#### Scenario: Environment cannot be read

- **WHEN** no config file is found and reading the environment fails
- **THEN** adoption is `none` and the result carries that failure

#### Scenario: One detection export

- **WHEN** the configuration package's public exports are read
- **THEN** they include `getVariantsAdoption` and do not include `detectOnboarding`
