## RENAMED Requirements

- FROM: `### Requirement: Instance open URL`
- TO: `### Requirement: Instance URL`
- FROM: `### Requirement: Instance dotenv`
- TO: `### Requirement: Instance env`

## MODIFIED Requirements

### Requirement: Instance URL

The system SHALL accept an optional `url` string on any entry of `variant.instances`: a URL template that may contain the placeholders `{{slug}}` and `{{port}}`, for example `http://{{slug}}.vw.localhost:{{port}}`. `url` SHALL NOT be an empty string. The key `open` on an instance SHALL fail validation. A Vite instance found by autodetection SHALL carry the default template `http://{{slug}}.vw.localhost:{{port}}`; a detected NestJS instance and an explicit instance carry only what they set. The system SHALL offer a function that returns the template of an instance with both placeholders replaced, or nothing when the instance has no template. This change does not launch the URL.

#### Scenario: Open template accepted

- **WHEN** an instance of kind `vite` or `nestjs` sets `url: http://{{slug}}.vw.localhost:{{port}}`
- **THEN** loading succeeds and the resolved instance carries that exact string

#### Scenario: Empty open template

- **WHEN** an instance sets `url: ""`
- **THEN** loading the configuration fails validation

#### Scenario: Former key refused

- **WHEN** an instance sets `open: http://{{slug}}.vw.localhost:{{port}}`
- **THEN** loading the configuration fails validation

#### Scenario: Autodetected Vite instance

- **WHEN** `variant.instances` is absent and a searched subdirectory contains Vite configuration
- **THEN** the detected instance carries the default `url` template, and a detected NestJS instance carries none

#### Scenario: Placeholders replaced

- **WHEN** the URL of an instance with the default template is requested for slug `add-auth` and the instance's port is 62060
- **THEN** the result is `http://add-auth.vw.localhost:62060`

### Requirement: Instance env

The system SHALL accept an optional `env` object on any entry of `variant.instances` with two optional settings: `sourceFile`, the path of an environment file relative to the instance's `dir` that is copied for a variant to `<worktree>/<dir>/<sourceFile>` and amended with that variant's values, and `overrides`, a map of templated values for the instance's commands and for that copy when it is created. A `sourceFile` that is absolute or climbs out of the instance directory SHALL fail validation. Unknown keys of `env`, a map of values directly under `env`, and the former instance keys `dotenv`, `dotenvSource` and `envAlways` SHALL fail validation. The system SHALL offer a function that returns the amended text for an instance: the source file's lines with each given variable replaced in place and each missing one appended, other lines and comments kept, and values holding whitespace or `#` quoted. When the source file is missing, `<sourceFile>.example` SHALL be the source; when that is missing too, the source SHALL count as empty. The function SHALL return nothing for an instance without `env.sourceFile`. This change does not write the copy.

#### Scenario: Dotenv accepted

- **WHEN** an instance sets `env: { sourceFile: .env, overrides: { PORT: "{{port}}" } }`
- **THEN** loading succeeds and the resolved instance carries both

#### Scenario: Former keys refused

- **WHEN** an instance sets `dotenv: .env`, `dotenvSource: ~/fe.env` or `envAlways: { A: b }`, or sets `env: { PORT: "{{port}}" }` without `sourceFile` and `overrides`
- **THEN** loading the configuration fails validation

#### Scenario: Source file outside the instance

- **WHEN** an instance sets `env.sourceFile` to `../.env` or `/etc/app.env`
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

- **WHEN** the instance has no `env.sourceFile`
- **THEN** nothing is returned

### Requirement: Example project

The repository SHALL ship a runnable example project in `example/`, outside the workspace packages: a Vite app `fe`, a NestJS app `be` that uses SQLite and ships `be/.env.example`, a seed script, a `variants.yaml` that lists both as instances (`url` on `fe`, `env.sourceFile` on `be`) with a seed command and SQLite settings, a `be/Dockerfile`, a multi-stage `fe/Dockerfile` that builds the app and serves it from `nginx:alpine` with `/api/` proxied to the `be` container, and a `mise.toml` that declares the tools needed (`bun`) and names the `variant` CLI from `github:jubr/variant-worktrees`, either as an active tool or in a commented-out line, because inside this repository the CLI comes from the workspace. Its dev servers SHALL keep the console across rebuilds, so the output of several instances stays readable in one terminal: the Vite configuration sets `clearScreen: false`, the `be` watch command passes `--no-clear-screen` to `bun --watch`, and the `be` `tsconfig.json` sets `preserveWatchOutput`. The test suites SHALL use this project as their fixture: the configuration of `variant-config` SHALL be loaded from it, its autodetected instances SHALL equal its explicit ones, and its seed script SHALL run against a variant database created by `variant-api`.

#### Scenario: Example configuration loads

- **WHEN** the configuration is loaded from `example/`
- **THEN** it validates and lists instances `fe` (Vite, `url`) and `be` (NestJS, `env.sourceFile`)

#### Scenario: Container files present

- **WHEN** the configuration of `example/` is loaded
- **THEN** every `container.dockerfile` of its instances names an existing file, and the `fe` Dockerfile has a `FROM nginx:alpine` stage

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
