# variant-api/provisioning Specification

## Purpose
Provisioning prepares a variant before its instances start: dependencies, per-variant environment files and storage,
and the ordered commands that build its database, so one configuration drives every project's setup.

## Requirements

### Requirement: Provisioning order

The system SHALL provision a variant in this order, stopping at the first failure: instance dependency installs, instance dotenv copies, the `up` commands, the entries of `variant.steps` in listed order, and the seed command. Every command SHALL run in its configured directory with the command environment. A failure SHALL report the step `name` (or the command) that failed, its exit status and its output, and SHALL NOT run later commands.

#### Scenario: Steps between up and seed

- **WHEN** a variant has `variant.up`, two steps and a seed command
- **THEN** the commands run as `up`, step one, step two, seed

#### Scenario: Step failure stops provisioning

- **WHEN** the first of two steps exits with status 3
- **THEN** provisioning fails naming that step and status 3, and the second step and the seed command do not run

#### Scenario: Step directory

- **WHEN** a step sets `dir: server` for a worktree `/w`
- **THEN** its command runs in `/w/server`

### Requirement: Command environment

The system SHALL run every provisioning, step, seed and instance command with the process environment plus `VARIANT_SLUG`, `VARIANT_TARGET` (the database target), `VARIANT_CONFIG` (the configuration path), the connection settings of the database (`POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` for PostgreSQL; the `MYSQL_` equivalents for MySQL), `POSTGRES_SCHEMA` or `MYSQL_SCHEMA` set to the variant's target, `SQLITE_DATABASE` for SQLite, the storage variable when storage is configured, and for every instance `VARIANT_<K>_PORT` and, when it has an `open` template, `VARIANT_<K>_URL` (where `<K>` is as in the runtime environment overrides). For commands that run on the host, a database host of `host.docker.internal` SHALL be replaced by `127.0.0.1`. The expanded `env` of a step or instance SHALL be added last and win over the rest.

#### Scenario: Database settings reach the command

- **WHEN** a PostgreSQL variant `demo` has `db.host: localhost` and `db.port: 5433` and a step runs
- **THEN** the step sees `POSTGRES_HOST=localhost`, `POSTGRES_PORT=5433` and `POSTGRES_SCHEMA=v_demo`

#### Scenario: Docker host rewritten for host commands

- **WHEN** `db.host` is `host.docker.internal` and a host command runs
- **THEN** the command sees `POSTGRES_HOST=127.0.0.1`

#### Scenario: Ports of all instances visible

- **WHEN** instances `fe` (port 62060) and `be` (port 62061) exist and a step runs
- **THEN** the step sees `VARIANT_FE_PORT=62060` and `VARIANT_BE_PORT=62061`

#### Scenario: Step env wins

- **WHEN** a step sets `env: { POSTGRES_SCHEMA: custom }`
- **THEN** the step sees `POSTGRES_SCHEMA=custom`

### Requirement: Conditional and quiet steps

The system SHALL skip a step when every variable named in its `unlessEnv` has the given value in the process environment, and SHALL print a line that names the skipped step. When a step sets `show`, the system SHALL print only the output lines that match the pattern, unless the step fails or verbose output is requested, in which case it SHALL print the full output.

#### Scenario: Skipped by environment

- **WHEN** a step has `unlessEnv: { SEED_DEMO_USER: "false" }` and `SEED_DEMO_USER` is `false`
- **THEN** the step does not run and the output names it as skipped

#### Scenario: Not skipped

- **WHEN** the same step runs with `SEED_DEMO_USER` unset
- **THEN** the step runs

#### Scenario: Filtered output

- **WHEN** a step with `show: "^Migration "` prints `query: SELECT 1` and `Migration Init applied`
- **THEN** only `Migration Init applied` is printed

#### Scenario: Verbose output

- **WHEN** the same step runs with verbose output requested
- **THEN** both lines are printed

#### Scenario: Failure prints everything

- **WHEN** the same step exits non-zero
- **THEN** the full output is part of the error

### Requirement: Instance dependency install

The system SHALL run an instance's `install` command in the instance directory before any other provisioning command when that directory has no `node_modules`, and SHALL skip it otherwise.

#### Scenario: Missing node_modules

- **WHEN** an instance with `install: touch installed` has no `node_modules` directory
- **THEN** the command runs in the instance directory

#### Scenario: Present node_modules

- **WHEN** the instance directory already has `node_modules`
- **THEN** the install command does not run

### Requirement: Dotenv copy

The system SHALL write the dotenv file of an instance for a variant worktree other than the primary one. When `<dir>/<dotenv>` does not exist in the worktree, the system SHALL write it from the source file, with the `env` and `envAlways` values applied, and SHALL print a line that names the source. The source SHALL be, in order, the file named by `dotenvSource` (or the environment variable `VARIANT_ENV_SOURCE`), the same path in the primary worktree, then its `.example` file, then an empty file; a missing source SHALL print a warning and continue. When the file already exists, the system SHALL keep it, print that the copy was skipped, and apply only `envAlways`. Values that hold whitespace or `#` SHALL be quoted. For the primary worktree nothing SHALL be copied and only `envAlways` SHALL be applied.

#### Scenario: Copy from the primary worktree

- **WHEN** the worktree has no `be/.env`, the primary worktree has `be/.env` with `PORT=3000`, and `env` is `{ PORT: "{{port}}" }` with port 62061
- **THEN** the worktree gets `be/.env` with `PORT=62061`

#### Scenario: Existing file kept

- **WHEN** the worktree already has `be/.env` with `PORT=1` and `env` sets `PORT` to 62061
- **THEN** the file still holds `PORT=1` and the output says the copy was skipped

#### Scenario: Always-applied values

- **WHEN** the worktree already has `be/.env` and `envAlways` is `{ PUBLIC_BASE_URL: "{{url}}" }`
- **THEN** the file holds the rendered URL after provisioning, other lines unchanged

#### Scenario: Explicit source

- **WHEN** `dotenvSource` names an existing file
- **THEN** that file is the source rather than the primary worktree's file

#### Scenario: Missing source

- **WHEN** neither the source, the primary worktree's file nor an example exists
- **THEN** a warning is printed and the file holds only the configured values

### Requirement: Variant storage directory

The system SHALL create the variant's storage directory (`variant.storage.dir` below the worktree) before the first provisioning command when storage is configured, and SHALL pass its absolute path in the configured variable to every provisioning, step, seed and instance command. The path SHALL NOT be below the state directory.

#### Scenario: Directory created

- **WHEN** `variant.storage` is `{}` and a variant `demo` is provisioned in `/w`
- **THEN** `/w/.storage` exists and commands see `STORAGE_ROOT=/w/.storage`

#### Scenario: Custom variable

- **WHEN** `variant.storage.env` is `APP_DATA`
- **THEN** commands see `APP_DATA` and no `STORAGE_ROOT`

#### Scenario: Not configured

- **WHEN** `variant.storage` is absent
- **THEN** no directory is created and no storage variable is set

### Requirement: Command echo

The system SHALL print the line `+ <command>` to the progress log before it runs each provisioning command: an instance `install`, an `up` command, a step and the seed command. The line SHALL hold the command text as it runs and SHALL be printed whether or not verbose output is requested. A step skipped through `unlessEnv` SHALL print no command line. The progress log SHALL be the `log` callback of the caller and SHALL default to standard error, so results on standard output are unchanged.

#### Scenario: Commands are printed before they run

- **WHEN** a variant has `variant.up`, one step and a seed command and is provisioned
- **THEN** the progress log receives `+ <up command>`, `+ <step command>` and `+ <seed command>` in that order, each before that command runs

#### Scenario: Skipped step prints no command

- **WHEN** a step is skipped through `unlessEnv`
- **THEN** the progress log has no line for its command

#### Scenario: Failure still names the command

- **WHEN** a step exits non-zero
- **THEN** its command line was printed before the run and the error names the step

### Requirement: Project directory

The system SHALL resolve every relative path of the configuration against the project directory: the directory of `variants.yaml` re-based onto the worktree of the variant. This covers instance `dir`, step `dir`, dotenv files and `dotenvSource`, the `container.dockerfile`, `container.static`, the image build context, `preRm` directories, and the working directory of the `up`, `watch`, seed and step commands that have no `dir`. When `variants.yaml` is in the root of the checkout, the project directory SHALL be the worktree itself. When it is in a subdirectory, the project directory SHALL be the same subdirectory of the worktree. A variant for `main` or without a worktree SHALL use the root of the git checkout that holds the current directory as its worktree, or the current directory outside a git repository, so running from any directory of the project gives the same result. The `{{worktree}}` placeholder and the storage directory SHALL stay relative to the worktree.

#### Scenario: Configuration in a subdirectory

- **WHEN** `app/variants.yaml` sets `seed: bun scripts/seed.mjs`, an instance `be` has `dir: be`, and the variant is provisioned from `app`
- **THEN** the seed command runs in `<checkout>/app` and the instance commands run in `<checkout>/app/be`

#### Scenario: Configuration in a subdirectory of a variant worktree

- **WHEN** the same variant `demo` has its own worktree `/w/_v-demo`
- **THEN** the seed command runs in `/w/_v-demo/app`

#### Scenario: Configuration in the checkout root

- **WHEN** `variants.yaml` is in the checkout root
- **THEN** commands run in the worktree root as before
