# variant-config Specification

## Purpose

The configuration package validates workspace settings, discovers database
connections, and resolves runtime and worktree locations for variant commands.

## Requirements

### Requirement: variants.yaml schema

The system SHALL validate `variants.yaml` against a JSON schema at parse time.

#### Scenario: Valid config file
- **WHEN** a workspace has `variants.yaml` with `db.host`, `db.port`, `db.user`, `db.password`, and `db.database` keys
- **THEN** the parser returns a typed config object

#### Scenario: Missing required field
- **WHEN** `variants.yaml` omits `db.host` from an explicit non-SQLite database config
- **THEN** validation throws an error with the field name and location

#### Scenario: Invalid type
- **WHEN** `db.port` is the string `"not-a-number"`
- **THEN** validation throws an error with the expected type

### Requirement: Connection config autodetection

The system SHALL detect connection config from mise environment values, then process environment values, with explicit config taking precedence.

#### Scenario: Mise env detected
- **WHEN** `mise.local.toml` defines `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, and `POSTGRES_DB`
- **THEN** the config builder loads those values into `db.*` fields

#### Scenario: Environment fallback
- **WHEN** `mise.local.toml` is absent and `process.env.POSTGRES_HOST` exists
- **THEN** the config builder uses environment values

#### Scenario: Explicit override
- **WHEN** `variants.yaml` has `db.host = "custom.host"` and mise env has `POSTGRES_HOST = "auto.host"`
- **THEN** resulting `config.db.host` is `"custom.host"`

### Requirement: Config CLI command

The system SHALL provide a `variant config` command that prints detected config as JSON.

#### Scenario: Print detected config
- **WHEN** a user runs `variant config`
- **THEN** stdout is JSON with `db` and `variants` sections

#### Scenario: Validation error reporting
- **WHEN** a user runs `variant config` and `variants.yaml` is invalid
- **THEN** stderr shows the validation error and the exit code is 1

### Requirement: Seed command configuration

The system SHALL allow `variants.yaml` to define a seed command per variant (`variants.<slug>.seed`) or for all variants (`variant.seed`). The former top-level `seed` key SHALL no longer be accepted.

#### Scenario: Global seed command
- **WHEN** `variants.yaml` has `variant.seed: "bun run db:seed"`
- **THEN** `variant provision` executes that command with variant environment

#### Scenario: Per-variant seed override
- **WHEN** config has `variants.main.seed = "echo skip"` and `variant.seed = "bun run db:seed"`
- **THEN** provisioning slug `main` runs `echo skip`

#### Scenario: Former top-level seed
- **WHEN** `variants.yaml` has a top-level `seed` key
- **THEN** loading the configuration fails validation

### Requirement: Runtime instance discovery

The system SHALL use explicitly configured runtime instances when present and otherwise discover Vite or NestJS instances by searching subdirectories from the directory containing `variants.yaml`.

#### Scenario: Explicit instances take precedence
- **WHEN** `variants.yaml` defines `variant.instances`
- **THEN** runtime commands use those instances without filesystem autodetection

#### Scenario: Vite instance autodetected
- **WHEN** `variant.instances` is absent and a searched subdirectory contains Vite configuration
- **THEN** the config includes that subdirectory as a Vite instance

#### Scenario: NestJS instance autodetected
- **WHEN** `variant.instances` is absent and a searched subdirectory contains NestJS configuration
- **THEN** the config includes that subdirectory as a NestJS instance

### Requirement: Variant worktree root resolution

The system SHALL resolve the base directory for `_v-<slug>` worktrees from explicit `variant.root` configuration or workspace and git metadata.

#### Scenario: Explicit variant root
- **WHEN** `variants.yaml` defines `variant.root`
- **THEN** the configured path, resolved relative to `variants.yaml`, is used as the worktree base

#### Scenario: Parent AGENTS symlink
- **WHEN** the parent directory of `variants.yaml` contains an `AGENTS.md` symlink targeting the main git directory
- **THEN** the symlink target's directory is used as the worktree base

#### Scenario: Git carrying directory fallback
- **WHEN** `variant.root` is absent and no parent `AGENTS.md` symlink exists
- **THEN** the git common or carrying directory containing the real `AGENTS.md` is used as the worktree base

### Requirement: Instance open URL

The system SHALL accept an optional `open` string on any entry of `variant.instances`: a URL template that may contain the placeholders `{{slug}}` and `{{port}}`, for example `http://{{slug}}.vw.localhost:{{port}}`. `open` SHALL NOT be an empty string. A Vite instance found by autodetection SHALL carry the default template `http://{{slug}}.vw.localhost:{{port}}`; a detected NestJS instance and an explicit instance carry only what they set. The system SHALL offer a function that returns the template of an instance with both placeholders replaced, or nothing when the instance has no template. This change does not launch the URL.

#### Scenario: Open template accepted

- **WHEN** an instance of kind `vite` or `nestjs` sets `open: http://{{slug}}.vw.localhost:{{port}}`
- **THEN** loading succeeds and the resolved instance carries that exact string

#### Scenario: Empty open template

- **WHEN** an instance sets `open: ""`
- **THEN** loading the configuration fails validation

#### Scenario: Autodetected Vite instance

- **WHEN** `variant.instances` is absent and a searched subdirectory contains Vite configuration
- **THEN** the detected instance carries the default `open` template, and a detected NestJS instance carries none

#### Scenario: Placeholders replaced

- **WHEN** the URL of an instance with the default template is requested for slug `add-auth` and the instance's port is 62060
- **THEN** the result is `http://add-auth.vw.localhost:62060`

### Requirement: Instance dotenv

The system SHALL accept an optional `dotenv` string on any entry of `variant.instances`: the path of an environment file, relative to the instance's `dir`, that is copied for a variant and amended with that variant's values. The system SHALL offer a function that returns the amended text for an instance: the source file's lines with each given variable replaced in place and each missing one appended, other lines and comments kept, and values holding whitespace or `#` quoted. When the source file is missing, `<dotenv>.example` SHALL be the source; when that is missing too, the source SHALL count as empty. The function SHALL return nothing for an instance without `dotenv`. This change does not write the copy.

#### Scenario: Dotenv accepted

- **WHEN** an instance sets `dotenv: .env`
- **THEN** loading succeeds and the resolved instance carries it

#### Scenario: Existing variable replaced

- **WHEN** the source holds `PORT=3000` and `# keep`, and the variant values are `PORT=62061` and `POSTGRES_SCHEMA=v_demo`
- **THEN** the amended text is `PORT=62061`, `# keep` and `POSTGRES_SCHEMA=v_demo`, in that order

#### Scenario: Example file as source

- **WHEN** `.env` does not exist and `.env.example` holds `PORT=3000`, and the variant values are `PORT=62061`
- **THEN** the amended text is `PORT=62061`

#### Scenario: Missing source

- **WHEN** neither the source file nor its `.example` exists
- **THEN** the amended text holds only the variant values

#### Scenario: No dotenv

- **WHEN** the instance has no `dotenv`
- **THEN** nothing is returned

### Requirement: Local runtime state

The system SHALL read ephemeral per-variant state from `variants.local.yaml` next to `variants.yaml`, in the variant's own worktree (`<prefix><slug>/variants.local.yaml`), and carry it as `runtime` in the resolved configuration. The file holds one optional `runtime` section with `slug`, `mode` (`up` or `watch`), `dir`, `db` and `instances`. `db` SHALL reuse the database settings schema, except that `port` MAY also be a string: digits, or a `{{NAME}}` template. `instances` SHALL be a record keyed by instance name; each entry holds optional `port`, `pid` and `url`. Every `{{NAME}}` in a string SHALL be replaced by the environment variable `NAME` when the file is read; an unset variable leaves the template unchanged, and a `db.port` that is then not numeric SHALL be left out of the resolved state. Unknown keys SHALL fail validation. A missing file SHALL mean no runtime state. The system SHALL offer a function that writes the `runtime` section, validated, keeping any other top-level keys, and the repository SHALL git-ignore `variants.local.yaml`. A JSON schema file `variants.local.yaml.schema.json` and `variants.local.example.yaml` SHALL ship next to the main ones under the same rules.

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

### Requirement: Instance ports

The system SHALL resolve the port of an instance from `runtime.instances.<name>.port` in the local runtime state, and otherwise pick a random free port between 1024 and 65535. An instance is keyed by its `name`, or by its `kind` when it has none. The system SHALL NOT write the state when resolving.

#### Scenario: Assigned port

- **WHEN** `runtime.instances.fe.port` is 62060 and the instance is named `fe`
- **THEN** its port is 62060

#### Scenario: Unnamed instance

- **WHEN** an instance of kind `vite` has no name and `runtime.instances.vite.port` is 62060
- **THEN** its port is 62060

#### Scenario: No assignment

- **WHEN** the runtime state holds no port for the instance
- **THEN** the port is a random free port between 1024 and 65535

### Requirement: Variant name prefix

The system SHALL accept an optional `variant.prefix` in `variants.yaml`, a non-empty string without path separators, that starts every name derived from a variant slug (`<prefix><slug>`): worktree directories today, and other per-variant names such as database schemas later. The prefix SHALL carry its own leading character and connector, for example `_v-`, so no consumer inserts a separator. When absent it SHALL default to `_v-`. The default SHALL be defined in `variant-config`. The resolved configuration SHALL always carry the prefix. The system SHALL also offer a lightweight reader that returns only the prefix for a directory, without resolving database settings, and returns `_v-` when no configuration file exists or the file cannot be read or is invalid.

#### Scenario: Default prefix

- **WHEN** `variants.yaml` does not define `variant.prefix`
- **THEN** the resolved prefix is `_v-`

#### Scenario: Custom prefix

- **WHEN** `variants.yaml` defines `variant.prefix: _work-`
- **THEN** the resolved prefix is `_work-`

#### Scenario: Invalid prefix

- **WHEN** `variant.prefix` is empty or contains `/`
- **THEN** loading the configuration fails validation

#### Scenario: Reading only the prefix

- **WHEN** the lightweight reader is called for a directory below a `variants.yaml` that defines `_work-`
- **THEN** it returns `_work-` without requiring any database settings

#### Scenario: No configuration

- **WHEN** the lightweight reader is called and no `variants.yaml` exists above the directory
- **THEN** it returns `_v-`

### Requirement: Chat renamer section

The system SHALL accept an optional top-level `chatRenamer` section in `variants.yaml` that carries the full set of options of `chat-renamer-config`: `trigger`, `hookScope`, `activationPatterns`, `worktreePrefixes` and `renameExistingDays`, each optional and validated by the schema owned by `chat-renamer-config`. Unknown keys inside the section SHALL fail validation. The system SHALL offer a lightweight reader that returns only this section for a directory, and an empty section when no configuration file exists or the file cannot be read or is invalid.

#### Scenario: Section with every option

- **WHEN** `variants.yaml` sets all five `chatRenamer` options to valid values
- **THEN** loading succeeds and the section is available unchanged

#### Scenario: Invalid option

- **WHEN** `chatRenamer.renameExistingDays` is `-1`
- **THEN** loading the configuration fails validation

#### Scenario: Unknown option

- **WHEN** `chatRenamer` contains a key that is not one of the five options
- **THEN** loading the configuration fails validation

#### Scenario: Reading only the section

- **WHEN** the lightweight reader is called for a directory below a `variants.yaml` that sets `chatRenamer.renameExistingDays: 30`
- **THEN** it returns `{ renameExistingDays: 30 }` without requiring any database settings

#### Scenario: No configuration

- **WHEN** the lightweight reader is called and no `variants.yaml` exists above the directory
- **THEN** it returns an empty section

### Requirement: Example configuration

The package SHALL ship `variants.example.yaml` (and `variants.local.example.yaml` for the local runtime file) next to `variants.yaml.schema.json`, specifying every option of the schema with an illustrative default and listing alternatives in end-of-line comments. The example SHALL validate against the schema, and a test SHALL fail when the schema holds an option the example omits.

#### Scenario: Example validates

- **WHEN** `variants.example.yaml` is parsed and validated
- **THEN** validation succeeds

#### Scenario: Example covers the schema

- **WHEN** an option is added to the schema and not to the example
- **THEN** the coverage test fails and names the missing option

### Requirement: Example project

The repository SHALL ship a runnable example project in `example/`, outside the workspace packages: a Vite app `fe`, a NestJS app `be` that uses SQLite and ships `be/.env.example`, a seed script, a `variants.yaml` that lists both as instances (`open` on `fe`, `dotenv` on `be`) with a seed command and SQLite settings, and a `mise.toml` that declares the tools needed, including the `variant` CLI from `github:jubr/variant-worktrees`. The test suites SHALL use this project as their fixture: the configuration of `variant-config` SHALL be loaded from it, its autodetected instances SHALL equal its explicit ones, and its seed script SHALL run against a variant database created by `variant-api`.

#### Scenario: Example configuration loads

- **WHEN** the configuration is loaded from `example/`
- **THEN** it validates and lists instances `fe` (Vite, `open`) and `be` (NestJS, `dotenv`)

#### Scenario: Autodetection agrees

- **WHEN** instances are autodetected in `example/`
- **THEN** their kinds and directories equal those of the explicit instances

#### Scenario: Seed runs on a variant database

- **WHEN** `variant-api` creates variant `demo` from a copy of the example and the seed script runs with the variant's database in `SQLITE_DATABASE`
- **THEN** the database holds the seeded rows

### Requirement: Main .vscode directory

`resolveMainVscodeDir` SHALL return the absolute path of the main checkout `.vscode` directory for a start directory. It SHALL NOT create that directory and SHALL NOT append a socket file name. A `.vscode` directory inside a `_v-*` worktree SHALL NOT be the result. A nested package `.vscode` that has no `settings.json` SHALL NOT be the result when the main checkout `.vscode` contains `settings.json`.

#### Scenario: Path for the main checkout

- **WHEN** resolution starts at `/work/vw/variant-worktrees`
- **THEN** the result is `/work/vw/variant-worktrees/.vscode`

#### Scenario: Package .vscode is skipped

- **WHEN** `/work/vw/variant-worktrees/packages/variant-vscode/.vscode/launch.json` exists and that `.vscode` directory has no `settings.json`
- **AND** `/work/vw/variant-worktrees/.vscode/settings.json` exists
- **AND** resolution starts at `/work/vw/variant-worktrees/packages/variant-vscode`
- **THEN** the result is `/work/vw/variant-worktrees/.vscode`

### Requirement: Linked checkout container

When a start directory sits under a container whose `AGENTS.md` is a symlink to the main checkout, resolution SHALL use that symlink target's `.vscode` directory. A `.vscode` directory on the container that symlinks at the main checkout's `.vscode` SHALL be the same directory. A `.vscode` directory inside a `_v-*` worktree SHALL NOT be the result, including when that worktree directory contains `settings.json`.

#### Scenario: Worktree under a symlink container

- **WHEN** `/work/vw/.vscode` symlinks to `/work/vw/variant-worktrees/.vscode`
- **AND** `/work/vw/AGENTS.md` symlinks to `/work/vw/variant-worktrees/AGENTS.md`
- **AND** `/work/vw/_v-lib-ipc` contains `variants.yaml` and its own `.vscode/settings.json`
- **AND** resolution starts at `/work/vw/_v-lib-ipc`
- **THEN** the result is `/work/vw/variant-worktrees/.vscode`

#### Scenario: Nested directory in the worktree

- **WHEN** the layout is the symlink container above and resolution starts at `/work/vw/_v-lib-ipc/packages/variant-api`
- **THEN** the result is `/work/vw/variant-worktrees/.vscode`

#### Scenario: Start at the container

- **WHEN** the layout is the symlink container above and resolution starts at `/work/vw`
- **THEN** the result is `/work/vw/variant-worktrees/.vscode`

#### Scenario: Start inside the main checkout

- **WHEN** the layout is the symlink container above and resolution starts at `/work/vw/variant-worktrees`
- **THEN** the result is `/work/vw/variant-worktrees/.vscode`

### Requirement: Single repo holding worktrees

When the directory that contains the `_v-*` worktrees also contains the real `AGENTS.md`, resolution SHALL return that directory's `.vscode`. A `.vscode` directory inside a worktree SHALL NOT be the result, including when it contains `settings.json`.

#### Scenario: Worktree under a single repo

- **WHEN** `/work/AGENTS.md` is a regular file
- **AND** `/work/_v-lib-ipc` contains `variants.yaml` and its own `.vscode/settings.json`
- **AND** resolution starts at `/work/_v-lib-ipc`
- **THEN** the result is `/work/.vscode`

#### Scenario: Nested directory in a single-repo worktree

- **WHEN** the layout is the single repo above and resolution starts at `/work/_v-lib-ipc/packages/variant-api`
- **THEN** the result is `/work/.vscode`

#### Scenario: Start at the single repo root

- **WHEN** the layout is the single repo above and resolution starts at `/work`
- **THEN** the result is `/work/.vscode`
