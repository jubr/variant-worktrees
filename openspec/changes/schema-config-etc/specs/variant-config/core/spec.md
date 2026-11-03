## RENAMED Requirements

- FROM: `### Requirement: Runtime instance discovery`
- TO: `### Requirement: Runtime watch discovery`
- FROM: `### Requirement: Instance URL`
- TO: `### Requirement: Watch URL`
- FROM: `### Requirement: Instance env`
- TO: `### Requirement: Watch env`

## MODIFIED Requirements

### Requirement: Runtime watch discovery

The system SHALL use explicitly configured runtime watches when present and otherwise discover Vite or NestJS watches by searching subdirectories from the directory containing `variants.yaml`.

#### Scenario: Explicit instances take precedence
- **WHEN** `variants.yaml` defines `variant.watches`
- **THEN** runtime commands use those watches without filesystem autodetection

#### Scenario: Vite instance autodetected
- **WHEN** `variant.watches` is absent and a searched subdirectory contains Vite configuration
- **THEN** the config includes that subdirectory as a Vite watch

#### Scenario: NestJS instance autodetected
- **WHEN** `variant.watches` is absent and a searched subdirectory contains NestJS configuration
- **THEN** the config includes that subdirectory as a NestJS watch

### Requirement: Watch URL

The system SHALL accept an optional `url` string on any entry of `variant.watches`: a URL template that may contain the placeholders `{{slug}}`, `{{abbr}}` (the resolved `variant.abbr`) and `{{port}}`, for example `http://{{slug}}.{{abbr}}.localhost:{{port}}`. `url` SHALL NOT be an empty string. The key `open` on a watch SHALL fail validation. A Vite watch found by autodetection SHALL carry the default template `http://{{slug}}.{{abbr}}.localhost:{{port}}`; a detected NestJS watch and an explicit watch carry only what they set. The system SHALL offer a function that returns the template of a watch with all placeholders replaced, or nothing when the watch has no template. This change does not launch the URL.

#### Scenario: Open template accepted

- **WHEN** a watch of kind `vite` or `nestjs` sets `url: http://{{slug}}.vw.localhost:{{port}}`
- **THEN** loading succeeds and the resolved watch carries that exact string

#### Scenario: Empty open template

- **WHEN** a watch sets `url: ""`
- **THEN** loading the configuration fails validation

#### Scenario: Former key refused

- **WHEN** a watch sets `open: http://{{slug}}.vw.localhost:{{port}}`
- **THEN** loading succeeds, the key is ignored and one warning names it

#### Scenario: Autodetected Vite instance

- **WHEN** `variant.watches` is absent and a searched subdirectory contains Vite configuration
- **THEN** the detected watch carries the default `url` template, and a detected NestJS watch carries none

#### Scenario: Placeholders replaced

- **WHEN** the URL of a watch with the default template is requested for slug `add-auth`, the abbreviation is `vw` and the watch's port is 62060
- **THEN** the result is `http://add-auth.vw.localhost:62060`

#### Scenario: Abbreviation placeholder in an explicit template

- **WHEN** a watch sets `url: http://{{abbr}}-{{slug}}.localhost:{{port}}`, the abbreviation is `otc`, the slug is `demo` and the port is 62060
- **THEN** the result is `http://otc-demo.localhost:62060`

### Requirement: Watch env

The system SHALL accept an optional `env` object on any entry of `variant.watches` with two optional settings: `sourceFile`, the path of an environment file relative to the watch's `dir` that is copied for a variant to `<worktree>/<dir>/<sourceFile>` and amended with that variant's values, and `overrides`, a map of templated values for the watch's commands and for that copy when it is created. A `sourceFile` that is absolute or climbs out of the watch directory SHALL fail validation. Unknown keys of `env`, a map of values directly under `env`, and the former watch keys `dotenv`, `dotenvSource` and `envAlways` SHALL be ignored with a warning. The system SHALL offer a function that returns the amended text for a watch: the source file's lines with each given variable replaced in place and each missing one appended, other lines and comments kept, and values holding whitespace or `#` quoted. When the source file is missing, `<sourceFile>.example` SHALL be the source; when that is missing too, the source SHALL count as empty. The function SHALL return nothing for a watch without `env.sourceFile`. This change does not write the copy.

#### Scenario: Dotenv accepted

- **WHEN** a watch sets `env: { sourceFile: .env, overrides: { PORT: "{{port}}" } }`
- **THEN** loading succeeds and the resolved watch carries both

#### Scenario: Former keys refused

- **WHEN** a watch sets `dotenv: .env`, `dotenvSource: ~/fe.env` or `envAlways: { A: b }`, or sets `env: { PORT: "{{port}}" }` without `sourceFile` and `overrides`
- **THEN** loading succeeds, none of those keys takes effect and one warning names each

#### Scenario: Source file outside the instance

- **WHEN** a watch sets `env.sourceFile` to `../.env` or `/etc/app.env`
- **THEN** loading the configuration fails validation

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

- **WHEN** the watch has no `env.sourceFile`
- **THEN** nothing is returned

### Requirement: Local runtime state

The system SHALL read ephemeral per-variant state from `variants.local.yaml` next to `variants.yaml`, in the variant's own worktree (`<prefix><slug>/variants.local.yaml`), and carry it as `runtime` in the resolved configuration. The file holds one optional `runtime` section with `slug`, `mode` (`up` or `watch`), `dir`, `log` (the path of the log file of a detached watch), `db` and `watches`. `db` SHALL reuse the database settings schema, except that `port` MAY also be a string: digits, or a `{{NAME}}` template. `watches` SHALL be a record keyed by watch key (the key of the entry in `variant.watches`); each entry holds optional `port`, `pid` and `url`. Every `{{NAME}}` in a string SHALL be replaced by the environment variable `NAME` when the file is read; an unset variable leaves the template unchanged, and a `db.port` that is then not numeric SHALL be left out of the resolved state. Unknown keys SHALL fail validation: the file is written by the system, so an unknown key means a version mismatch rather than a typo. A `runtime.instances` record written by an earlier version SHALL be read as `watches`. A missing file SHALL mean no runtime state. The system SHALL offer a function that writes the `runtime` section, validated, keeping any other top-level keys, and the repository SHALL git-ignore `variants.local.yaml`. A JSON schema file `variants.local.yaml.schema.json` and `variants.local.example.yaml` SHALL ship next to the main ones under the same rules.

#### Scenario: Runtime read

- **WHEN** `variants.local.yaml` sets `runtime.slug: demo` and `runtime.watches.fe.port: 62060`
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

#### Scenario: Log path read

- **WHEN** `variants.local.yaml` sets `runtime.log: /work/_v-demo/variants.watch.log`
- **THEN** the resolved runtime state carries that `log`

#### Scenario: No local file

- **WHEN** no `variants.local.yaml` exists
- **THEN** the resolved configuration has no runtime state

#### Scenario: Legacy instances record

- **WHEN** `variants.local.yaml` sets `runtime.instances.fe.port: 62060` and no `runtime.watches`
- **THEN** the resolved configuration carries a `watches` record with an `fe` port of 62060, and the next write of the runtime section stores `watches`

#### Scenario: Invalid local file

- **WHEN** `runtime` holds an unknown key or `watches.fe.pid` is `0`
- **THEN** loading the configuration fails validation

#### Scenario: Writing the runtime section

- **WHEN** the runtime section is written to a directory whose `variants.local.yaml` has other top-level keys
- **THEN** the file holds the new `runtime` and the other keys unchanged

### Requirement: Example project

The repository SHALL ship a runnable example project in `example/`, outside the workspace packages: a Vite app `fe`, a NestJS app `be` that uses SQLite and ships `be/.env.example`, a seed script, a `variants.yaml` that lists both as watches (`url` on `fe`, `env.sourceFile` on `be`) with a seed command and SQLite settings, a `be/Dockerfile`, a multi-stage `fe/Dockerfile` that builds the app and serves it from `nginx:alpine` with `/api/` proxied to the `be` container, and a `mise.toml` that declares the tools needed (`bun`) and names the `variant` CLI from `github:jubr/variant-worktrees`, either as an active tool or in a commented-out line, because inside this repository the CLI comes from the workspace. Its dev servers SHALL keep the console across rebuilds, so the output of several watches stays readable in one terminal: the Vite configuration sets `clearScreen: false`, the `be` watch command passes `--no-clear-screen` to `bun --watch`, and the `be` `tsconfig.json` sets `preserveWatchOutput`. The test suites SHALL use this project as their fixture: the configuration of `variant-config` SHALL be loaded from it, its autodetected watches SHALL equal its explicit ones, and its seed script SHALL run against a variant database created by `variant-api`.

#### Scenario: Example configuration loads

- **WHEN** the configuration is loaded from `example/`
- **THEN** it validates and lists watches `fe` (Vite, `url`) and `be` (NestJS, `env.sourceFile`)

#### Scenario: Container files present

- **WHEN** the configuration of `example/` is loaded
- **THEN** every `container.dockerfile` of its watches names an existing file, and the `fe` Dockerfile has a `FROM nginx:alpine` stage

#### Scenario: Autodetection agrees

- **WHEN** watches are autodetected in `example/`
- **THEN** their kinds and directories equal those of the explicit watches

#### Scenario: Seed runs on a variant database

- **WHEN** `variant-api` creates variant `demo` from a copy of the example and the seed script runs with the variant's database in `SQLITE_DATABASE`
- **THEN** the database holds the seeded rows

#### Scenario: Dev servers keep the console

- **WHEN** the example's Vite configuration, `be` watch script and `be` `tsconfig.json` are read
- **THEN** `clearScreen` is `false`, the script passes `--no-clear-screen` and `preserveWatchOutput` is `true`

#### Scenario: Tools in mise.toml

- **WHEN** `example/mise.toml` is read
- **THEN** its other active tools are exactly `bun`, and `github:jubr/variant-worktrees` appears as an active tool or in a commented-out line

### Requirement: variants.yaml schema

The system SHALL validate `variants.yaml` against a JSON schema at parse time. A key that the schema does not define (an extra property) SHALL NOT fail validation: it SHALL be ignored and reported as a warning that names the file and the path of the key. Every other violation (a wrong type, a value out of range, a missing required key, a failed cross-field rule) SHALL fail validation, and its errors SHALL be reported together with the warnings. The warnings SHALL be part of the resolved configuration.

#### Scenario: Valid config file
- **WHEN** a workspace has `variants.yaml` with `db.host`, `db.port`, `db.user`, `db.password`, and `db.database` keys
- **THEN** the parser returns a typed config object

#### Scenario: Missing required field
- **WHEN** `variants.yaml` omits `db.host` from an explicit non-SQLite database config
- **THEN** validation throws an error with the field name and location

#### Scenario: Invalid type
- **WHEN** `db.port` is the string `"not-a-number"`
- **THEN** validation throws an error with the expected type

#### Scenario: Extra property warns
- **WHEN** `variants.yaml` sets `db.colour: red` next to valid settings
- **THEN** loading succeeds, the resolved configuration has no `colour` and carries one warning that names `db.colour`

#### Scenario: Extra property next to an error
- **WHEN** `variants.yaml` sets `db.colour: red` and `db.port: "abc"`
- **THEN** loading fails with the error for `db.port`, and the warning for `db.colour` is reported with it

#### Scenario: Warnings reach the user
- **WHEN** a user runs a `variant` command and `variants.yaml` has an extra property
- **THEN** stderr shows a line starting `warning:` that names the file and the key, and the command runs as usual

### Requirement: Seed command configuration

The system SHALL allow `variants.yaml` to define a seed command per variant (`variants.<slug>.seed`) or for all variants (`variant.seed`). A former top-level `seed` key SHALL be ignored with a warning, like any unknown key.

#### Scenario: Global seed command
- **WHEN** `variants.yaml` has `variant.seed: "bun run db:seed"`
- **THEN** `variant provision` executes that command with variant environment

#### Scenario: Per-variant seed override
- **WHEN** config has `variants.main.seed = "echo skip"` and `variant.seed = "bun run db:seed"`
- **THEN** provisioning slug `main` runs `echo skip`

#### Scenario: Former top-level seed
- **WHEN** `variants.yaml` has a top-level `seed` key
- **THEN** loading succeeds, the key is ignored and one warning names it

### Requirement: Chat renamer section

The system SHALL accept an optional top-level `chatRenamer` section in `variants.yaml` that carries the full set of options of `chat-renamer-config`: `trigger`, `hookScope`, `activationPatterns`, `worktreePrefixes` and `renameExistingDays`, each optional and validated by the schema owned by `chat-renamer-config`. Unknown keys inside the section SHALL be ignored with a warning. The system SHALL offer a lightweight reader that returns only this section for a directory, and an empty section when no configuration file exists or the file cannot be read or is invalid.

#### Scenario: Section with every option

- **WHEN** `variants.yaml` sets all five `chatRenamer` options to valid values
- **THEN** loading succeeds and the section is available unchanged

#### Scenario: Invalid option

- **WHEN** `chatRenamer.renameExistingDays` is `-1`
- **THEN** loading the configuration fails validation

#### Scenario: Unknown option

- **WHEN** `chatRenamer` contains a key that is not one of the options
- **THEN** loading succeeds, the key is ignored and one warning names it

#### Scenario: Reading only the section

- **WHEN** the lightweight reader is called for a directory below a `variants.yaml` that sets `chatRenamer.renameExistingDays: 30`
- **THEN** it returns `{ renameExistingDays: 30 }` without requiring any database settings

#### Scenario: No configuration

- **WHEN** the lightweight reader is called and no `variants.yaml` exists above the directory
- **THEN** it returns an empty section
