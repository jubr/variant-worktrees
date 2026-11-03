# variant-config/cfg-watches Specification

## Purpose
Watches in `variants.yaml` are a record keyed by name. This capability defines the key rules, the per-watch runtime options and container description, and the watch commands autodetection derives, so one record drives `up` and `watch`.

## Requirements

### Requirement: Watches keyed by name
The system SHALL accept `variant.watches` as a record whose keys are the watch keys and whose values are the watch settings (an optional `kind` of `vite` or `nestjs`, an optional `dir`, and the other watch options). A key SHALL start with a letter and hold only letters, digits, `-` and `_`. The `dir` of a watch (relative to the worktree) SHALL default to its key. Watches have no `name` setting; the key is the name, and a `name` key SHALL be ignored with a warning. A list in place of the record SHALL fail validation, and so SHALL two keys that map to the same environment variable segment (letters uppercased, every other character replaced by `_`). The watches found by autodetection SHALL be keyed by the base name of their directory, or by their kind when the directory is the configuration directory, with `-2`, `-3`, and so on appended to a repeated key. Order of watches SHALL be the order of the keys in the file; autodetected watches SHALL be ordered by directory.

#### Scenario: Record accepted

- **WHEN** `variant.watches` is `{ fe: { kind: vite, dir: fe }, be: { kind: nestjs, dir: be } }`
- **THEN** loading succeeds and the watches are `fe` then `be`

#### Scenario: Kind is optional

- **WHEN** `variant.watches` is `{ be: { watch: bun run start:dev } }`
- **THEN** loading succeeds without a warning and the watch has no `kind`

#### Scenario: Default directory

- **WHEN** `variant.watches` is `{ fe: { kind: vite }, be: { kind: nestjs, dir: server } }`
- **THEN** loading succeeds, the directory of `fe` is `fe` and the directory of `be` is `server`

#### Scenario: List or name setting refused

- **WHEN** `variant.watches` is a list of watch settings
- **THEN** loading the configuration fails validation

#### Scenario: Name setting ignored

- **WHEN** a watch sets `name: api`
- **THEN** loading succeeds, the setting is ignored and one warning names `name`

#### Scenario: Colliding environment segments

- **WHEN** `variant.watches` has the keys `my-api` and `my_api`
- **THEN** loading the configuration fails validation naming both keys

#### Scenario: Autodetected keys

- **WHEN** autodetection finds a Vite app in `fe` and a NestJS app in `be`
- **THEN** the watches are keyed `be` and `fe`, in directory order

#### Scenario: Repeated directory name

- **WHEN** autodetection finds apps in `a/web` and `b/web`
- **THEN** the keys are `web` and `web-2`

### Requirement: Watch runtime options
The system SHALL accept on any entry of `variant.watches` these optional settings: `env` (an object with `sourceFile` and `overrides`, see the watch env requirement of `variant-config/core`), `install` (a shell command) and `ready` (a URL path starting with `/`). The templated `env.overrides` SHALL be passed to the commands of that watch in `up` and `watch` and written into its env file copy when the copy is created. `install` SHALL run in the watch directory when that directory has no `node_modules`. `ready` SHALL be a path that answers an HTTP request with a success status when the watch serves.

#### Scenario: Options accepted

- **WHEN** a watch sets `env: { overrides: { PORT: "${port}", PUBLIC_BASE_URL: "${url}" } }`, `install: bun install --frozen-lockfile` and `ready: /api/health/live`
- **THEN** loading succeeds and the resolved watch carries them

#### Scenario: Ready path without slash

- **WHEN** a watch sets `ready: api/health`
- **THEN** loading the configuration fails validation

### Requirement: Watch container
The system SHALL accept an optional `container` on any entry of `variant.watches` that describes how the watch runs under `up`. It has a required `dockerfile` (relative to the worktree, built with the worktree as context) and an optional `internalPort` (the port inside the container, defaulting to 80). The Dockerfile owns everything else about the container: its base image, its build, the files it serves and its web server configuration. A `container` without `dockerfile`, with an `internalPort` that is not a positive integer, SHALL fail validation. Any other key (including the former `image`, `build`, `static`, `port`, `proxy`, `volumes` and `env`) SHALL be ignored with a warning.

#### Scenario: Static site with proxy

- **WHEN** a watch `fe` sets `container: { dockerfile: fe/Dockerfile }` and `be` sets `container: { dockerfile: be/Dockerfile, internalPort: 3000 }`
- **THEN** loading succeeds; the Dockerfile of `fe` builds, serves and proxies

#### Scenario: Application container without port

- **WHEN** a watch sets `container: { dockerfile: be/Dockerfile }` without `internalPort`
- **THEN** loading succeeds and `up` publishes the watch to container port 80

#### Scenario: Container without Dockerfile

- **WHEN** a watch sets `container: { internalPort: 3000 }` or `container: { image: app:latest }`, which has no `dockerfile`
- **THEN** loading the configuration fails validation

#### Scenario: Proxy to unknown watch

- **WHEN** a container sets `dockerfile` and `proxy: { path: /api/, to: be }`, whether or not `be` exists
- **THEN** loading succeeds, `proxy` takes no effect and one warning names it

#### Scenario: Other former container keys refused

- **WHEN** a container sets `dockerfile` and also `static: dist`, `build: "bunx vite build"`, `volumes: [...]`, `env: {...}` or `port: 3000`
- **THEN** loading succeeds, none of those keys takes effect and one warning names each

#### Scenario: Wrong type stays an error

- **WHEN** a container sets `internalPort: "3000"`
- **THEN** loading the configuration fails validation

### Requirement: Autodetected watch commands
The system SHALL give every autodetected watch a `watch` command that keeps the console across rebuilds, so the output of several watches stays readable in one terminal. For a Vite watch the command SHALL be `bun run dev` when its `package.json` has a `dev` script, otherwise `bunx --bun vite`, followed by `--clearScreen false` unless a Vite configuration file of the watch sets `clearScreen`. For a NestJS watch the command SHALL be `bun run start:dev` when its `package.json` has a `start:dev` script, otherwise `bunx nest start --watch`, followed by `--preserveWatchOutput` unless the `tsconfig.json` of the watch sets `preserveWatchOutput` to `true`. When the `start:dev` script of a NestJS watch starts with `bun --watch` or `bun --hot`, the command SHALL be that script with `--no-clear-screen` inserted after the watch flag and nothing appended, unless the script already has it. Explicit watches SHALL keep exactly the `watch` they configure.

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
