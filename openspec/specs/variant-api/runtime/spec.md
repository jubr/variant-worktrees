# variant-api/runtime Specification

## Purpose
The runtime commands start and stop the watches of a variant, either as containers or as supervised host processes,
and record what runs in the variant's own `variants.local.yaml`, so a variant is usable in a browser with one command.

## Requirements

### Requirement: Runtime preparation

The system SHALL prepare a variant for both `up` and `watch` in this order: ensure its worktree (the primary worktree for slug `main`), assign a port to every watch, prepare the database target, provision (see the provisioning capability), and only then start watches. A port SHALL be the resolved watch port (environment override, then `.cache/variant/state.yaml`, then a free port of `variant.ports.range`); no two watches SHALL share a port, and a conflict between two overrides SHALL fail naming both variables. The database target SHALL be created clean by `up` (an existing variant schema or database is dropped first) and created only when missing by `watch`. For slug `main` the target SHALL never be created or dropped.

#### Scenario: Ports reused

- **WHEN** `state.yaml` records port 62060 for watch `fe` and `up` runs again
- **THEN** `fe` is assigned 62060

#### Scenario: Environment port wins

- **WHEN** `VARIANT_FE_PORT` is `62070` and `state.yaml` records 62060 for `fe`
- **THEN** `fe` is assigned 62070 and that port is recorded

#### Scenario: Conflicting overrides

- **WHEN** `VARIANT_FE_PORT` and `VARIANT_BE_PORT` are both `62070`
- **THEN** preparation fails naming both variables

#### Scenario: Distinct ports

- **WHEN** two watches have no recorded ports
- **THEN** they receive two different free ports

#### Scenario: Up recreates the target

- **WHEN** variant `demo` already has a database target and `up` runs
- **THEN** the target is recreated empty before provisioning

#### Scenario: Watch keeps the target

- **WHEN** variant `demo` already has a database target holding rows and `watch` runs
- **THEN** the target and its rows are kept

#### Scenario: Main target untouched

- **WHEN** `up` or `watch` runs for slug `main`
- **THEN** the primary worktree is used, no worktree is created, and the database target is neither created nor dropped

### Requirement: Up runs watches as containers

The system SHALL start every watch that has a `container` as a container named `v-<key>-<slug>` on a network named `v-net-<slug>`, creating the network when missing and replacing a container of that name that already exists. The image SHALL be built from `container.dockerfile` with the worktree as context into `v-<key>:v-<slug>`, so a Dockerfile can build and serve a watch on its own. The container SHALL publish the watch's assigned port, on all interfaces, to `container.internalPort` (80 when it is not set). The container SHALL receive as environment the variant variables of the command environment: the database connection settings with the host unchanged, the database target variable, `VARIANT_SLUG`, `VARIANT_TARGET` and `VARIANT_<K>_PORT` and `VARIANT_<K>_URL` of every watch. It SHALL NOT receive the watch `env.overrides`, which describe the host process, and SHALL NOT receive `SQLITE_DATABASE` or the storage variable, which hold host paths. When the database host is `host.docker.internal`, the container SHALL be able to resolve it to the host. A container SHALL reach another container of the variant by the name `v-<key>-<slug>` on the shared network. Watches SHALL start in their listed order, waiting `supervise.startDelaySeconds` between two of them. A watch without `container` SHALL NOT be started by `up`.

#### Scenario: Application container

- **WHEN** watch `be` sets `container: { dockerfile: be/Dockerfile, internalPort: 3000 }` and `up` runs for slug `demo` with assigned port 62061
- **THEN** the engine builds `v-be:v-demo`, creates network `v-net-demo` and runs container `v-be-demo` publishing `0.0.0.0:62061` to container port 3000

#### Scenario: Static site

- **WHEN** watch `fe` sets `container: { dockerfile: fe/Dockerfile }` and `up` runs with assigned port 62060
- **THEN** container `v-fe-demo` publishes `0.0.0.0:62060` to container port 80 and no build command runs on the host

#### Scenario: Container environment

- **WHEN** `be` sets `env: { overrides: { PORT: "${port}" } }` and `up` starts its container
- **THEN** the container receives `VARIANT_SLUG=demo` and `VARIANT_BE_PORT`, and no `PORT`

#### Scenario: Host paths withheld

- **WHEN** the dialect is SQLite, storage is configured and `up` starts a container
- **THEN** the container receives neither `SQLITE_DATABASE` nor the storage variable

#### Scenario: Replacing a running container

- **WHEN** container `v-be-demo` exists and `up` runs again
- **THEN** the old container is removed and a new one is started with the same port

#### Scenario: Host database from a container

- **WHEN** `db.host` is `host.docker.internal`
- **THEN** the container is started so that `host.docker.internal` resolves to the host and receives that host value unchanged

#### Scenario: Missing engine

- **WHEN** no container engine is available
- **THEN** `up` fails before building or starting anything, naming `docker` and `podman`

### Requirement: Worktree file selects the watches

When the loaded configuration is a worktree's `variants.yaml` and that file defines `variant.watches`, `watch` and `up` SHALL start those watches and SHALL NOT start watches autodetected from the primary checkout. The command environment SHALL be the one the provisioning capability already sets, including `VARIANT_<K>_PORT` for every watch and the expanded `env.overrides` of that watch. A watch `api` whose overrides set `PORT` to `${port}` SHALL see `PORT` equal to the port assigned to `api`. A watch `spa` whose command contains `--port "$VARIANT_SPA_PORT"` and whose overrides set `VARIANT_API_PORT` to `${api.port}` SHALL see `VARIANT_SPA_PORT` equal to the port assigned to `spa` and `VARIANT_API_PORT` equal to the port assigned to `api`, and the started command SHALL be the command from the worktree file.

#### Scenario: Ports from the worktree file

- **WHEN** `/work/_v-demo/variants.yaml` defines watch `api` with `env.overrides.PORT: ${port}` and watch `spa` with command `task app:dev -- --host 0.0.0.0 --port "$VARIANT_SPA_PORT" --strictPort` and `env.overrides.VARIANT_API_PORT: ${api.port}`, `/work/app/variants.yaml` defines no watches, and `watch` runs with working directory `/work/_v-demo`
- **THEN** the `api` process environment has `PORT` equal to the port assigned to `api`
- **AND** the `spa` process environment has `VARIANT_SPA_PORT` equal to the spa port and `VARIANT_API_PORT` equal to the api port
- **AND** the started spa command is that `task app:dev` command, not `bun run dev`

#### Scenario: Primary file is not autodetected

- **WHEN** that same `watch` runs
- **THEN** no process is started with `bun run start:dev` taken from `/work/app`

### Requirement: The watch command runs watches as host processes

The system SHALL start the `watch` command of every watch as a process in the watch directory with the command environment, stdout and stderr attached to the console, and SHALL record the process id of each in the runtime state. A watch without a `watch` command SHALL NOT be started. Watches SHALL start in their listed order, waiting `supervise.startDelaySeconds` between two of them. The command SHALL print the command line it runs for each watch.

#### Scenario: Two watchers

- **WHEN** watches `be` and `fe` both have a `watch` command
- **THEN** both processes run in their directories, `be` starts first, and their pids are recorded

#### Scenario: Watch without watch command

- **WHEN** watch `be` has no `watch` command and `fe` has one
- **THEN** only `fe` is started

#### Scenario: Variant-wide command

- **WHEN** no watch has `watch`
- **THEN** no process is started, whatever else the configuration holds

### Requirement: Watch supervision

The system SHALL keep an attached `watch` running until it is interrupted, a watch process ends, or the worktree directory disappears. On SIGINT or SIGTERM it SHALL terminate every watch process together with its descendants, remove the process ids from the runtime state, and end with exit status 130. When one watch process ends it SHALL terminate the others and end with exit status 1. When the worktree directory disappears (checked every `supervise.checkoutPollSeconds`) it SHALL terminate the processes, drop the variant's database target unless it is the main target, clear the runtime state and end with exit status 1. When `watch` is given the `detach` option it SHALL start the processes detached from the console, write the runtime state, and return without waiting, readiness checks or opening URLs.

#### Scenario: Interrupt

- **WHEN** an attached watch is interrupted with SIGINT
- **THEN** both watch processes and their children are terminated, no pid remains in the runtime state, and the exit status is 130

#### Scenario: One watch dies

- **WHEN** one of two watched processes exits on its own
- **THEN** the other is terminated and the exit status is 1

#### Scenario: Checkout removed

- **WHEN** the worktree directory is deleted while watching and `checkoutPollSeconds` is 1
- **THEN** the processes are terminated, the variant's database target is dropped, and the exit status is 1

#### Scenario: Checkout check disabled

- **WHEN** `checkoutPollSeconds` is 0 and the worktree directory is deleted
- **THEN** the watch keeps running until interrupted or a watch ends

#### Scenario: Detached watch

- **WHEN** `watch` runs with `detach`
- **THEN** the call returns with the pids recorded in `.cache/variant/state.yaml` while the processes keep running

#### Scenario: Re-run replaces leftovers

- **WHEN** a watch for slug `demo` is already running and `watch` runs again
- **THEN** the recorded processes are terminated before new ones start

### Requirement: Mode switch

The system SHALL allow only one runtime per slug. `watch` SHALL stop the variant's containers and network before starting host processes, keeping the database target. `up` SHALL stop the variant's recorded host processes before starting containers. Other slugs SHALL be left untouched.

#### Scenario: Up stops a watch

- **WHEN** slug `demo` runs a detached watch and `up` runs for `demo`
- **THEN** the watch processes are terminated before containers start, and slug `other` is unaffected

#### Scenario: Watch stops containers

- **WHEN** slug `demo` has containers and `watch` runs for `demo`
- **THEN** the containers and network `v-net-demo` are removed and the database target is kept

### Requirement: Runtime state recording

The system SHALL write `.cache/variant/state.yaml` and `.cache/variant/runtime.yaml` in the variant directory after watches start. `state.yaml` SHALL hold `slug`, `mode` (`up` or `watch`), `dir` (the worktree path), `dialect`, `target` and, for every watch by key, `port`, the rendered `url` when it has a `url` template, `startedAt`, and, for host processes, `pid`. `startedAt` SHALL be the local time that watch started, formatted `YYYY-MM-DD_HH:MM:SS` (zero-padded date, underscore, zero-padded 24-hour time, no timezone suffix). An existing `createdAt` SHALL be kept. `runtime.yaml` SHALL hold the resolved detection dump, including the resolved database settings, each watch command, and the configuration path. Either file SHALL be left untouched when its serialized content would not change. The system SHALL NOT write `variants.local.yaml`.

#### Scenario: Written after up

- **WHEN** `up` finishes for slug `demo` with `fe` on port 62060 and a `url` template
- **THEN** `state.yaml` holds `mode: up`, `slug: demo` and `watches.fe` with port 62060 and `url: http://demo.vw.localhost:62060`

#### Scenario: Pids written for watch

- **WHEN** `watch` starts host processes
- **THEN** each watch entry in `state.yaml` holds the `pid` of its process

#### Scenario: Start time written

- **WHEN** `watch` starts `fe` at 12:30:00 local time on 2026-11-04
- **THEN** `watches.fe.startedAt` in `state.yaml` is `2026-11-04_12:30:00`

#### Scenario: Created time kept

- **WHEN** `createdAt` is `2026-01-02_03:04:05` and `watch` rewrites the state
- **THEN** `createdAt` is still `2026-01-02_03:04:05`

#### Scenario: Detection dump written

- **WHEN** `watch` starts a watch whose command is `task app:dev -- --port "$VARIANT_SPA_PORT"`
- **THEN** `runtime.yaml` contains that command and the configuration path

#### Scenario: Unchanged content is not rewritten

- **WHEN** `watch` records a state identical to the `state.yaml` already on disk
- **THEN** the modification time of `state.yaml` is unchanged

#### Scenario: Other keys kept

- **WHEN** a legacy `variants.local.yaml` has another top-level key and `state.yaml` is written
- **THEN** `state.yaml` holds the operational keys, and the legacy file is not rewritten

### Requirement: Readiness and opening

The system SHALL, after watches start in attached `up` and attached `watch`, poll `http://127.0.0.1:<port><ready>` once per second for every watch that sets `ready`, up to `supervise.readyTimeoutSeconds`. When all answer with a success status it SHALL print the URL of each watch with a `url` template and open each in the system browser, unless opening is disabled. When no watch sets `ready` it SHALL print and open the URLs right after start. On timeout it SHALL print a warning and leave the watches running. Failure to launch a browser SHALL NOT fail the command.

#### Scenario: Open after ready

- **WHEN** `be` has `ready: /health` that starts answering after 2 seconds and `fe` has a `url` template
- **THEN** the URL of `fe` is opened after `be` answers

#### Scenario: Open disabled

- **WHEN** `variant.open` is `false`
- **THEN** URLs are printed and no browser is launched

#### Scenario: Ready timeout

- **WHEN** a watch never answers within `readyTimeoutSeconds`
- **THEN** a warning is printed, no URL is opened, and the watches keep running

### Requirement: Down

The system SHALL provide `down` for a slug that stops every recorded host process with its descendants, removes the variant's containers and its network, and clears `mode`, `log` and `watches` from `.cache/variant/state.yaml` while keeping `slug`, `createdAt`, `dir`, `dialect` and `target`. It SHALL drop the process facts from `.cache/variant/runtime.yaml` in the same way. It SHALL keep the database target and the storage directory, and SHALL work for slug `main`. A variant that has nothing running SHALL succeed without changes.

#### Scenario: Down after watch

- **WHEN** slug `demo` runs a detached watch and `down` runs for `demo`
- **THEN** the processes are terminated and `state.yaml` has no `mode`, `log` or `watches`

#### Scenario: Down after up

- **WHEN** slug `demo` runs containers and `down` runs
- **THEN** the containers and network `v-net-demo` are removed and the database target still exists

#### Scenario: Nothing running

- **WHEN** `down` runs for a slug with no runtime state
- **THEN** the call succeeds and reports nothing stopped

#### Scenario: Stale pid

- **WHEN** the recorded pid no longer exists
- **THEN** `down` ignores it and still clears the runtime state

#### Scenario: Created time kept

- **WHEN** `state.yaml` has `createdAt: 2026-01-02_03:04:05` and `down` runs
- **THEN** `createdAt` is still `2026-01-02_03:04:05`

### Requirement: Container command echo

The system SHALL print the line `+ <command>` to the progress log before it runs each command of the container runtime that changes state: an image build, a network create or remove, and a container remove or run. The engine commands SHALL be printed as the engine name followed by its arguments, and the value of every `-e NAME=value` argument SHALL be printed as `-e NAME=***`. Read-only `inspect` calls SHALL NOT be printed. The progress log SHALL be the `log` callback of the caller and SHALL default to standard error. This applies to `up`, to `down` and to the stop that `watch`, `up` and `implode` run first.

#### Scenario: Up prints its engine commands

- **WHEN** `up` starts a watch with a `container`
- **THEN** the progress log receives `+ <engine> build ...`, then `+ <engine> network create`, then `+ <engine> run ...`

#### Scenario: Environment values are hidden

- **WHEN** `up` starts a container whose environment includes `POSTGRES_PASSWORD=secret`
- **THEN** the printed line holds `-e POSTGRES_PASSWORD=***` and no line holds `secret`

#### Scenario: Down prints its engine commands

- **WHEN** `down` removes a container and its network
- **THEN** the progress log receives `+ <engine> rm -f <container>` and `+ <engine> network rm <network>`

### Requirement: Watch without commands

The system SHALL print a warning to the progress log when `watch` starts no process because no watch has a `watch` command. The warning SHALL say that nothing was started and name `watch` on a watch as the way to set a command. The command SHALL otherwise behave as before.

#### Scenario: Nothing to start

- **WHEN** `watch` runs for watches that have no `watch` command
- **THEN** the progress log receives a warning that no process was started and names `watch`

#### Scenario: Commands present

- **WHEN** at least one watch has a `watch` command
- **THEN** no such warning is printed

### Requirement: Detached watch log

A `watch` with the `detach` option SHALL write the stdout and stderr of every process it starts, interleaved as they are produced, to one log file `.cache/variant/watch.log` in the variant directory (git-ignored, removed with the worktree). It SHALL truncate that file when it starts, write the line `[<key>] <command>` for each process before it starts, and record the absolute path as `log` in `.cache/variant/state.yaml`. Output SHALL reach the file while the processes run, so a reader can follow it with `tail -f`. An attached `watch` SHALL keep its output on the console, write no log file, and record no `log`. `down` SHALL remove `log` from the state file and keep the file. `up` SHALL write no log file.

#### Scenario: Detached output reaches the file

- **WHEN** `watch` runs detached with a command that prints `ready` and keeps running
- **THEN** `.cache/variant/watch.log` contains `ready` while the process still runs

#### Scenario: Log path recorded

- **WHEN** `watch` runs detached for slug `demo`
- **THEN** `state.yaml` holds `log` with the absolute path of `.cache/variant/watch.log`

#### Scenario: Two processes, one file

- **WHEN** watches `be` and `fe` both print a line and run detached
- **THEN** both lines are in the same file, below the lines `[be] <command>` and `[fe] <command>`

#### Scenario: Restart truncates

- **WHEN** a detached watch runs again for the same variant
- **THEN** the file holds only the output of the new run

#### Scenario: Attached keeps the console

- **WHEN** `watch` runs attached
- **THEN** the output goes to the console, no log file is written and no `log` is recorded

#### Scenario: Down drops the record

- **WHEN** `down` stops a detached watch
- **THEN** `log` is no longer in `state.yaml` and the file still exists
