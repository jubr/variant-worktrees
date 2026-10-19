## ADDED Requirements

### Requirement: Instances keyed by name

The system SHALL accept `variant.instances` as a record whose keys are the instance keys and whose values are the instance settings (`kind`, `dir`, and the other instance options). A key SHALL start with a letter and hold only letters, digits, `-` and `_`. Instances SHALL NOT have a `name` setting; the key is the name. A list in place of the record SHALL fail validation, and so SHALL two keys that map to the same environment variable segment (letters uppercased, every other character replaced by `_`). The instances found by autodetection SHALL be keyed by the base name of their directory, or by their kind when the directory is the configuration directory, with `-2`, `-3`, and so on appended to a repeated key. Order of instances SHALL be the order of the keys in the file; autodetected instances SHALL be ordered by directory.

#### Scenario: Record accepted

- **WHEN** `variant.instances` is `{ fe: { kind: vite, dir: fe }, be: { kind: nestjs, dir: be } }`
- **THEN** loading succeeds and the instances are `fe` then `be`

#### Scenario: List or name setting refused

- **WHEN** `variant.instances` is a list of instance settings, or an instance sets `name: api`
- **THEN** loading the configuration fails validation

#### Scenario: Colliding environment segments

- **WHEN** `variant.instances` has the keys `my-api` and `my_api`
- **THEN** loading the configuration fails validation naming both keys

#### Scenario: Autodetected keys

- **WHEN** autodetection finds a Vite app in `fe` and a NestJS app in `be`
- **THEN** the instances are keyed `be` and `fe`, in directory order

#### Scenario: Repeated directory name

- **WHEN** autodetection finds apps in `a/web` and `b/web`
- **THEN** the keys are `web` and `web-2`

### Requirement: Runtime environment overrides

The system SHALL let environment variables override the runtime state of the variant being run: for an instance with key `K`, `VARIANT_<K>_PORT`, `VARIANT_<K>_URL` and `VARIANT_<K>_PID`, where `<K>` is the key with letters uppercased and every other character replaced by `_` (for example `VARIANT_BE_PORT` for `be`, `VARIANT_MY_API_URL` for `my-api`). An override SHALL win over the same value in `variants.local.yaml`, which wins over a derived value. An empty variable SHALL count as unset. A port or pid variable that is not a positive integer, or a URL variable that is not an absolute URL, SHALL fail with an error that names the variable. Overrides SHALL apply only to the instances of the loaded configuration and only to the loaded variant's own state, not to the states found by runtime state discovery.

#### Scenario: Port override wins

- **WHEN** `variants.local.yaml` records port 62060 for `be` and `VARIANT_BE_PORT` is `62099`
- **THEN** the resolved runtime port of `be` is 62099

#### Scenario: Override without a file

- **WHEN** no `variants.local.yaml` exists and `VARIANT_FE_URL` is `http://demo.vw.localhost:62060`
- **THEN** the resolved runtime state holds that URL for `fe`

#### Scenario: Key with a hyphen

- **WHEN** the instance key is `my-api` and `VARIANT_MY_API_PORT` is `62010`
- **THEN** the resolved runtime port of `my-api` is 62010

#### Scenario: Empty variable ignored

- **WHEN** `VARIANT_BE_PORT` is the empty string
- **THEN** the value from `variants.local.yaml` is used

#### Scenario: Invalid override

- **WHEN** `VARIANT_BE_PORT` is `abc`
- **THEN** loading fails with an error that names `VARIANT_BE_PORT`

#### Scenario: Discovery ignores overrides

- **WHEN** `VARIANT_BE_PORT` is `62099` and runtime state discovery reads another worktree's file that records port 62060 for `be`
- **THEN** the discovered port is 62060

### Requirement: Branch naming settings

The system SHALL accept an optional `variant.baseBranch`, a non-empty string naming the branch that new variant branches start from and that a variant must be merged into before it is imploded, defaulting to `main`. The system SHALL accept an optional `variant.branchPrefixes`, a non-empty list of strings that each end in `/`, defaulting to `["feat/", "fix/"]`. The first entry SHALL prefix the branch of a new variant worktree. Every entry, and `feature/`, SHALL be removed from a branch name when a slug is derived from it. The resolved configuration SHALL always carry both settings.

#### Scenario: Defaults

- **WHEN** `variants.yaml` defines neither option
- **THEN** the resolved base branch is `main` and the resolved prefixes are `feat/` and `fix/`

#### Scenario: Custom values

- **WHEN** `variant.baseBranch` is `develop` and `variant.branchPrefixes` is `["task/"]`
- **THEN** the resolved configuration carries exactly those values

#### Scenario: Invalid prefix

- **WHEN** an entry of `variant.branchPrefixes` is empty or does not end in `/`
- **THEN** loading the configuration fails validation

### Requirement: Command templates

The system SHALL expand templates in the string values of the `env` of every entry of `variant.steps`, the `env`, `envAlways` and `container.env` of every entry of `variant.instances`, and the `container.volumes` of every entry of `variant.instances`. The variant placeholders SHALL be replaced first: `{{slug}}`, `{{schema}}` (the database target of the variant), `{{storage}}` (the absolute storage directory), `{{worktree}}` (the absolute worktree path), `{{url}}` (the rendered `open` URL of the instance, empty when it has none), `{{port}}` (the port of the instance the value belongs to; empty for a step) and `{{port.<name>}}` (the port of another instance, by its key). Then `{{NAME}}` SHALL be replaced by the process environment variable `NAME`, and `{{NAME:-default}}` by that variable or, when it is unset or empty, by `default`. A `{{NAME}}` whose variable is unset SHALL fail with an error that names the variable.

#### Scenario: Variant placeholders

- **WHEN** an instance `env` value is `{{slug}}-{{port}}` for slug `demo` and port 62060
- **THEN** the expanded value is `demo-62060`

#### Scenario: Port of another instance

- **WHEN** the instance `fe` has the value `{{port.be}}` and the instance `be` has port 62061
- **THEN** the expanded value is `62061`

#### Scenario: Environment default

- **WHEN** a value is `{{JWT_SECRET:-local-{{slug}}}}`, the slug is `demo`, and `JWT_SECRET` is unset
- **THEN** the expanded value is `local-demo`

#### Scenario: Environment value wins over default

- **WHEN** a value is `{{JWT_SECRET:-local}}` and `JWT_SECRET` is `s3cret`
- **THEN** the expanded value is `s3cret`

#### Scenario: Unset variable without default

- **WHEN** a value is `{{MISSING_VAR}}` and `MISSING_VAR` is unset
- **THEN** expansion fails with an error that names `MISSING_VAR`

### Requirement: Container engine and browser opening

The system SHALL accept an optional `variant.containerEngine`, either `docker` or `podman`, and an optional boolean `variant.open`, defaulting to `true`. The environment variable `CONTAINER_ENGINE` SHALL take precedence over `variant.containerEngine`. When neither is set, the engine SHALL be `docker` when a `docker` executable is found on `PATH`, otherwise `podman`, otherwise container commands SHALL fail with an error that names both. The environment variable `VARIANT_OPEN=0` SHALL take precedence over `variant.open`.

#### Scenario: Configured engine

- **WHEN** `variant.containerEngine` is `podman` and `CONTAINER_ENGINE` is unset
- **THEN** container commands run with `podman`

#### Scenario: Environment engine wins

- **WHEN** `variant.containerEngine` is `podman` and `CONTAINER_ENGINE` is `docker`
- **THEN** container commands run with `docker`

#### Scenario: No engine

- **WHEN** neither option nor variable is set and neither `docker` nor `podman` is on `PATH`
- **THEN** a container command fails with an error naming `docker` and `podman`

#### Scenario: Opening disabled

- **WHEN** `variant.open` is `false`, or `VARIANT_OPEN` is `0`
- **THEN** the resolved configuration reports that URLs are not opened

#### Scenario: Invalid engine

- **WHEN** `variant.containerEngine` is `nerdctl`
- **THEN** loading the configuration fails validation

### Requirement: Variant storage

The system SHALL accept an optional `variant.storage` with `dir`, a path relative to the worktree defaulting to `.storage`, and `env`, the name of an environment variable that carries the absolute storage directory to commands, defaulting to `STORAGE_ROOT`. When `variant.storage` is absent a variant has no storage directory, `{{storage}}` is empty, and no storage environment variable is set. A `dir` that is absolute or climbs out of the worktree SHALL fail validation.

#### Scenario: Defaults

- **WHEN** `variant.storage` is `{}`
- **THEN** the resolved directory is `.storage` and the variable is `STORAGE_ROOT`

#### Scenario: Escaping directory

- **WHEN** `variant.storage.dir` is `../shared`
- **THEN** loading the configuration fails validation

#### Scenario: No storage

- **WHEN** `variant.storage` is absent
- **THEN** the resolved configuration has no storage settings

### Requirement: Provisioning steps

The system SHALL accept an optional list `variant.steps`. Each step has a required `name` and `run` (shell commands), and optional `dir` (a path relative to the worktree, default the worktree root, never absolute or climbing out of it), `env` (a map of templated values), `unlessEnv` (a map of environment variable names to values) and `show` (a regular expression). Step names SHALL be unique within the list. Unknown keys SHALL fail validation.

#### Scenario: Valid steps

- **WHEN** `variant.steps` holds `{ name: migrations, run: "bun run migrate", dir: server, show: "^Migration " }`
- **THEN** loading succeeds and the step is carried unchanged

#### Scenario: Duplicate names

- **WHEN** two steps are named `migrations`
- **THEN** loading the configuration fails validation naming the duplicate

#### Scenario: Invalid pattern

- **WHEN** a step `show` is not a valid regular expression
- **THEN** loading the configuration fails validation

### Requirement: Instance runtime options

The system SHALL accept on any entry of `variant.instances` these optional settings: `env` and `envAlways` (maps of templated values), `dotenvSource` (a path of an environment file; absolute, or relative to the primary worktree), `install` (a shell command) and `ready` (a URL path starting with `/`). `env` SHALL be passed to the commands of that instance in `up` and `watch` and written into its dotenv copy when the copy is created; `envAlways` SHALL be passed likewise and written again into the copy on every run. `install` SHALL run in the instance directory when that directory has no `node_modules`. `ready` SHALL be a path that answers an HTTP request with a success status when the instance serves.

#### Scenario: Options accepted

- **WHEN** an instance sets `env: { PORT: "{{port}}" }`, `envAlways: { PUBLIC_BASE_URL: "{{url}}" }`, `install: bun install --frozen-lockfile` and `ready: /api/health/live`
- **THEN** loading succeeds and the resolved instance carries them

#### Scenario: Ready path without slash

- **WHEN** an instance sets `ready: api/health`
- **THEN** loading the configuration fails validation

### Requirement: Instance container

The system SHALL accept an optional `container` on any entry of `variant.instances` that describes how the instance runs under `up`. It has optional `image`, `dockerfile` (relative to the worktree, built with the worktree as context), `build` (a shell command that runs in the instance directory before the container starts), `static` (a directory relative to the instance directory whose files are served), `port` (the port inside the container), `proxy` (`{ path, to }`: requests below the path `path`, starting and ending with `/`, are forwarded to the instance with the key `to`), `volumes` (a list of `host:container` mounts, templated) and `env` (a map of templated values). An instance with `static` SHALL be served by the image `nginx:alpine` unless `image` is set; its `port` defaults to 80. An instance without `static` SHALL set `image` or `dockerfile`, and `port`. `proxy.to` SHALL name another instance that has `container.port`. Unknown keys SHALL fail validation.

#### Scenario: Static site with proxy

- **WHEN** an instance `fe` sets `container: { build: "bunx vite build", static: dist, proxy: { path: /api/, to: be } }` and `be` sets `container: { dockerfile: be/Dockerfile, port: 3000 }`
- **THEN** loading succeeds

#### Scenario: Application container without port

- **WHEN** an instance sets `container: { image: app:latest }` and no `static`
- **THEN** loading the configuration fails validation

#### Scenario: Proxy to unknown instance

- **WHEN** `proxy.to` names an instance that does not exist or has no `container.port`
- **THEN** loading the configuration fails validation naming the target

### Requirement: Supervision settings

The system SHALL accept an optional `variant.supervise` with `startDelaySeconds` (default 2), `readyTimeoutSeconds` (default 180) and `checkoutPollSeconds` (default 5). The delay SHALL be the wait between starting one watched instance and the next. `readyTimeoutSeconds` SHALL be the wait for the instances that set `ready`. A `checkoutPollSeconds` of 0 SHALL disable the checkout check. Negative numbers SHALL fail validation.

#### Scenario: Defaults

- **WHEN** `variant.supervise` is absent
- **THEN** the resolved values are 2, 180 and 5

#### Scenario: Negative value

- **WHEN** `variant.supervise.startDelaySeconds` is `-1`
- **THEN** loading the configuration fails validation

### Requirement: Implode settings

The system SHALL accept an optional `variant.implode` with `preRm` (a list of directory names), `restore` (a list of file names), `untracked` (a list of glob patterns that may hold `{{slug}}`), `requireMerged` (boolean, default `true`) and `maxDiffLines` (non-negative integer, default 200). `preRm` entries and `restore` entries SHALL NOT contain a path separator or climb out of a directory. `preRm`, `restore` and `untracked` SHALL default to empty lists. The resolved configuration SHALL always carry `requireMerged` and `maxDiffLines`.

#### Scenario: Example settings

- **WHEN** `variant.implode.preRm` is `[dist, node_modules, .cache, out]` and `restore` is `[package-lock.json, bun.lock]`
- **THEN** loading succeeds and the resolved lists equal those values

#### Scenario: Defaults

- **WHEN** `variant.implode` is absent
- **THEN** the resolved lists are empty, `requireMerged` is `true` and `maxDiffLines` is 200

#### Scenario: Path in a name

- **WHEN** a `preRm` entry is `a/b` or `..`
- **THEN** loading the configuration fails validation

### Requirement: Runtime state discovery

The system SHALL offer a function that finds the local runtime states of all variants of a workspace. It SHALL read exactly `<root>/<prefix>*/variants.local.yaml`, where `<root>` is the resolved variant root and `<prefix>` the resolved `variant.prefix`, and `<main>/variants.local.yaml`, where `<main>` is the directory of the primary git worktree (a sibling of the prefixed directories, or the root itself when the root holds the main checkout). It SHALL search no other directories. It SHALL return the directory and the resolved `runtime` section of each file that has one, with environment templates replaced as when a single file is read. A file that cannot be read or is invalid SHALL be skipped and reported by directory, without failing the search. Environment overrides SHALL NOT apply to the returned states.

#### Scenario: Prefixed worktrees

- **WHEN** the root holds `_v-demo` and `_v-other`, each with a `variants.local.yaml` carrying a `runtime.slug`, and the prefix is `_v-`
- **THEN** the function returns both, each with its directory

#### Scenario: Main checkout

- **WHEN** the primary worktree is `<root>/variant-worktrees` and it holds a `variants.local.yaml` with `runtime.slug: main`
- **THEN** the function returns it together with the prefixed worktrees

#### Scenario: Root is the main checkout

- **WHEN** the primary worktree is the root itself and the root holds a `variants.local.yaml` with a `runtime`
- **THEN** the function returns it

#### Scenario: Other directories ignored

- **WHEN** `<root>/scratch/variants.local.yaml` and `<root>/_v-demo/packages/x/variants.local.yaml` exist
- **THEN** neither is returned

#### Scenario: Custom prefix

- **WHEN** the prefix is `_work-` and the root holds `_v-old` and `_work-demo`, each with a runtime file
- **THEN** only `_work-demo` and the main checkout are searched

#### Scenario: Invalid file

- **WHEN** one `variants.local.yaml` holds an unknown `runtime` key and another is valid
- **THEN** the valid one is returned and the invalid one is reported with its directory

#### Scenario: File without runtime

- **WHEN** a `variants.local.yaml` has no `runtime` section
- **THEN** it is not returned

### Requirement: Instance port resolution

The system SHALL resolve the port of an instance, by its key, from the first of: the environment variable `VARIANT_<K>_PORT`, `runtime.instances.<key>.port` in the local runtime state, and a random free port between 1024 and 65535 that is not in `variant.reservedPorts`. `variant.reservedPorts` SHALL be an optional list of ports, defaulting to `[3000, 4200, 5432]`, and the resolved configuration SHALL always carry it. The system SHALL NOT write the state when resolving.

#### Scenario: Assigned port

- **WHEN** `runtime.instances.fe.port` is 62060 and the instance key is `fe`
- **THEN** its port is 62060

#### Scenario: No assignment

- **WHEN** neither the environment nor the runtime state holds a port for the instance
- **THEN** the port is a random free port between 1024 and 65535

#### Scenario: Reserved ports are never picked

- **WHEN** no port is assigned and `variant.reservedPorts` is `[3000, 4200, 5432]`
- **THEN** the picked port is none of 3000, 4200 and 5432

#### Scenario: Custom reserved ports

- **WHEN** `variant.reservedPorts` is `[]`
- **THEN** the picked port may be any free port between 1024 and 65535

#### Scenario: Reserved port assigned explicitly

- **WHEN** `VARIANT_BE_PORT` is 3000 and 3000 is reserved
- **THEN** its port is 3000, because reservation limits only picked ports

### Requirement: Autodetected watch commands

The system SHALL give every autodetected instance a `watch` command that keeps the console across rebuilds, so the output of several instances stays readable in one terminal. For a Vite instance the command SHALL be `bun run dev` when its `package.json` has a `dev` script, otherwise `bunx --bun vite`, followed by `--clearScreen false` unless a Vite configuration file of the instance sets `clearScreen`. For a NestJS instance the command SHALL be `bun run start:dev` when its `package.json` has a `start:dev` script, otherwise `bunx nest start --watch`, followed by `--preserveWatchOutput` unless the `tsconfig.json` of the instance sets `preserveWatchOutput` to `true`. When the `start:dev` script of a NestJS instance starts with `bun --watch` or `bun --hot`, the command SHALL be that script with `--no-clear-screen` inserted after the watch flag and nothing appended, unless the script already has it. Explicit instances SHALL keep exactly the `watch` they configure.

#### Scenario: Vite flag added

- **WHEN** a Vite application has a `dev` script and a configuration file without `clearScreen`
- **THEN** its autodetected `watch` is `bun run dev --clearScreen false`

#### Scenario: Project setting respected

- **WHEN** the Vite configuration file sets `clearScreen`, or the `tsconfig.json` of a NestJS application sets `preserveWatchOutput` to `true`
- **THEN** the autodetected `watch` has no console flag

#### Scenario: Nest without a script

- **WHEN** a NestJS application has no `start:dev` script and its `tsconfig.json` does not set `preserveWatchOutput`
- **THEN** its autodetected `watch` is `bunx nest start --watch --preserveWatchOutput`

#### Scenario: Bun watch script

- **WHEN** the `start:dev` script of a NestJS application is `bun --watch src/main.ts`
- **THEN** its autodetected `watch` is `bun --watch --no-clear-screen src/main.ts`

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
