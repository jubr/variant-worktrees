## MODIFIED Requirements

### Requirement: Local runtime state

The system SHALL read ephemeral per-variant state from `variants.local.yaml` next to `variants.yaml`, in the variant's own worktree (`<prefix><slug>/variants.local.yaml`), and carry it as `runtime` in the resolved configuration. The file holds one optional `runtime` section with `slug`, `mode` (`up` or `watch`), `dir`, `db` and `instances`. `db` SHALL reuse the database settings schema, except that `port` MAY also be a string: digits, or a `{{NAME}}` template. `instances` SHALL be a record keyed by instance key (the key of the entry in `variant.instances`); each entry holds optional `port`, `pid` and `url`. Every `{{NAME}}` in a string SHALL be replaced by the environment variable `NAME` when the file is read; an unset variable leaves the template unchanged, and a `db.port` that is then not numeric SHALL be left out of the resolved state. Unknown keys SHALL fail validation. A missing file SHALL mean no runtime state. The system SHALL offer a function that writes the `runtime` section, validated, keeping any other top-level keys, and the repository SHALL git-ignore `variants.local.yaml`. A JSON schema file `variants.local.yaml.schema.json` and `variants.local.example.yaml` SHALL ship next to the main ones under the same rules.

#### Scenario: Runtime read

- **WHEN** `variants.local.yaml` sets `runtime.slug: demo` and `runtime.instances.fe.port: 62060`
- **THEN** the resolved configuration carries `runtime.slug` `demo` and an `fe` port of 62060

#### Scenario: Database port from the environment

- **WHEN** `runtime.db.port` is `'{{POSTGRES_PORT}}'` and `POSTGRES_PORT` is `5433`
- **THEN** the resolved `runtime.db.port` is 5433

#### Scenario: Unset environment variable

- **WHEN** `runtime.db.port` is `'{{POSTGRES_PORT}}'` and `POSTGRES_PORT` is unset
- **THEN** the resolved runtime state has no `db.port`

#### Scenario: Reused database schema

- **WHEN** `runtime.db` sets `schema: v_demo` and `dialect: postgres`
- **THEN** they validate with the rules of `db`, and `runtime.db.port: -1` fails validation

#### Scenario: No local file

- **WHEN** no `variants.local.yaml` exists
- **THEN** the resolved configuration has no runtime state

#### Scenario: Invalid local file

- **WHEN** `runtime` holds an unknown key or `instances.fe.pid` is `0`
- **THEN** loading the configuration fails validation

#### Scenario: Writing the runtime section

- **WHEN** the runtime section is written to a directory whose `variants.local.yaml` has other top-level keys
- **THEN** the file holds the new `runtime` and the other keys unchanged

### Requirement: Example project

The repository SHALL ship a runnable example project in `example/`, outside the workspace packages: a Vite app `fe`, a NestJS app `be` that uses SQLite and ships `be/.env.example`, a seed script, a `variants.yaml` that lists both as instances (`open` on `fe`, `dotenv` on `be`) with a seed command and SQLite settings, and a `mise.toml` that declares the tools needed (`bun`) and names the `variant` CLI from `github:jubr/variant-worktrees`, either as an active tool or in a commented-out line, because inside this repository the CLI comes from the workspace. Its dev servers SHALL keep the console across rebuilds, so the output of several instances stays readable in one terminal: the Vite configuration sets `clearScreen: false`, the `be` watch command passes `--no-clear-screen` to `bun --watch`, and the `be` `tsconfig.json` sets `preserveWatchOutput`. The test suites SHALL use this project as their fixture: the configuration of `variant-config` SHALL be loaded from it, its autodetected instances SHALL equal its explicit ones, and its seed script SHALL run against a variant database created by `variant-api`.

#### Scenario: Example configuration loads

- **WHEN** the configuration is loaded from `example/`
- **THEN** it validates and lists instances `fe` (Vite, `open`) and `be` (NestJS, `dotenv`)

#### Scenario: Autodetection agrees

- **WHEN** instances are autodetected in `example/`
- **THEN** their kinds and directories equal those of the explicit instances

#### Scenario: Seed runs on a variant database

- **WHEN** `variant-api` creates variant `demo` from a copy of the example and the seed script runs with the variant's database in `SQLITE_DATABASE`
- **THEN** the database holds the seeded rows

#### Scenario: Dev servers keep the console

- **WHEN** the example's Vite configuration, `be` watch script and `be` `tsconfig.json` are read
- **THEN** `clearScreen` is `false`, the script passes `--no-clear-screen` and `preserveWatchOutput` is `true`

#### Scenario: Tools in mise.toml

- **WHEN** `example/mise.toml` is read
- **THEN** its other active tools are exactly `bun`, and `github:jubr/variant-worktrees` appears as an active tool or in a commented-out line

## REMOVED Requirements

### Requirement: Instance ports
**Reason**: Replaced by "Instance port resolution", which keys instances by their record key (instances have no `name`) and adds environment overrides.
**Migration**: Key `runtime.instances` by the key of the entry in `variant.instances`; an instance that was unnamed is now keyed by its directory base name.
