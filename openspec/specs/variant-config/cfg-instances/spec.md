# variant-config/cfg-instances Specification

## Purpose
Instances in `variants.yaml` are a record keyed by name. This capability defines the key rules, the per-instance runtime options and container description, and the watch commands autodetection derives, so one record drives `up` and `watch`.

## Requirements

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

### Requirement: Instance runtime options
The system SHALL accept on any entry of `variant.instances` these optional settings: `env` (an object with `sourceFile` and `overrides`, see the instance env requirement of `variant-config/core`), `install` (a shell command) and `ready` (a URL path starting with `/`). The templated `env.overrides` SHALL be passed to the commands of that instance in `up` and `watch` and written into its env file copy when the copy is created. `install` SHALL run in the instance directory when that directory has no `node_modules`. `ready` SHALL be a path that answers an HTTP request with a success status when the instance serves.

#### Scenario: Options accepted

- **WHEN** an instance sets `env: { overrides: { PORT: "{{port}}", PUBLIC_BASE_URL: "{{url}}" } }`, `install: bun install --frozen-lockfile` and `ready: /api/health/live`
- **THEN** loading succeeds and the resolved instance carries them

#### Scenario: Ready path without slash

- **WHEN** an instance sets `ready: api/health`
- **THEN** loading the configuration fails validation

### Requirement: Instance container
The system SHALL accept an optional `container` on any entry of `variant.instances` that describes how the instance runs under `up`. It has a required `dockerfile` (relative to the worktree, built with the worktree as context) and an optional `internalPort` (the port inside the container, defaulting to 80). The Dockerfile owns everything else about the container: its base image, its build, the files it serves and its web server configuration. A `container` without `dockerfile`, with an `internalPort` that is not a positive integer, or with any other key (including the former `image`, `build`, `static`, `port`, `proxy`, `volumes` and `env`) SHALL fail validation.

#### Scenario: Static site with proxy

- **WHEN** an instance `fe` sets `container: { dockerfile: fe/Dockerfile }` and `be` sets `container: { dockerfile: be/Dockerfile, internalPort: 3000 }`
- **THEN** loading succeeds; the Dockerfile of `fe` builds, serves and proxies

#### Scenario: Application container without port

- **WHEN** an instance sets `container: { dockerfile: be/Dockerfile }` without `internalPort`
- **THEN** loading succeeds and `up` publishes the instance to container port 80

#### Scenario: Container without Dockerfile

- **WHEN** an instance sets `container: { internalPort: 3000 }` or `container: { image: app:latest }`
- **THEN** loading the configuration fails validation

#### Scenario: Proxy to unknown instance

- **WHEN** a container sets `proxy: { path: /api/, to: be }`, whether or not `be` exists
- **THEN** loading the configuration fails validation naming `proxy`

#### Scenario: Other former container keys refused

- **WHEN** a container sets `static: dist`, `build: "bunx vite build"`, `volumes: [...]`, `env: {...}` or `port: 3000`
- **THEN** loading the configuration fails validation

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
