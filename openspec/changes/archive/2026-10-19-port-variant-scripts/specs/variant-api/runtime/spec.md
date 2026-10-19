## Purpose

The runtime commands start and stop the instances of a variant, either as containers or as supervised host processes,
and record what runs in the variant's own `variants.local.yaml`, so a variant is usable in a browser with one command.

## ADDED Requirements

### Requirement: Runtime preparation

The system SHALL prepare a variant for both `up` and `watch` in this order: ensure its worktree (the primary worktree for slug `main`), assign a port to every instance, prepare the database target, provision (see the provisioning capability), and only then start instances. A port SHALL be the resolved instance port (environment override, then `variants.local.yaml`, then a free unreserved port); no two instances SHALL share a port, and a conflict between two overrides SHALL fail naming both variables. The database target SHALL be created clean by `up` (an existing variant schema or database is dropped first) and created only when missing by `watch`. For slug `main` the target SHALL never be created or dropped.

#### Scenario: Ports reused

- **WHEN** `variants.local.yaml` records port 62060 for instance `fe` and `up` runs again
- **THEN** `fe` is assigned 62060

#### Scenario: Environment port wins

- **WHEN** `VARIANT_FE_PORT` is `62070` and `variants.local.yaml` records 62060 for `fe`
- **THEN** `fe` is assigned 62070 and that port is recorded

#### Scenario: Conflicting overrides

- **WHEN** `VARIANT_FE_PORT` and `VARIANT_BE_PORT` are both `62070`
- **THEN** preparation fails naming both variables

#### Scenario: Distinct ports

- **WHEN** two instances have no recorded ports
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

### Requirement: Up runs instances as containers

The system SHALL start every instance that has a `container` as a container named `v-<key>-<slug>` on a network named `v-net-<slug>`, creating the network when missing and replacing a container of that name that already exists. The container SHALL publish the instance's assigned port, on all interfaces, to the container `port`. Before starting an instance the system SHALL run its `container.build` command in the instance directory. An instance with `dockerfile` SHALL be built from it with the worktree as context into the image `<image>:v-<slug>` (`image` defaulting to `v-<key>`); an instance with only `image` SHALL run that image. An instance with `static` SHALL run the image mounted read-only with the static directory. The container SHALL receive the database connection settings with the host unchanged, the database target variable, the instance `env`, and `container.env`, with later ones winning, and the mounts of `container.volumes`. When the database host is `host.docker.internal`, the container SHALL be able to resolve it to the host. Instances SHALL start in their listed order, waiting `supervise.startDelaySeconds` between two of them. An instance without `container` SHALL NOT be started by `up`.

#### Scenario: Application container

- **WHEN** instance `be` sets `container: { dockerfile: be/Dockerfile, port: 3000, image: app }` and `up` runs for slug `demo` with assigned port 62061
- **THEN** the engine builds `app:v-demo`, creates network `v-net-demo` and runs container `v-be-demo` publishing `0.0.0.0:62061` to container port 3000

#### Scenario: Static site

- **WHEN** instance `fe` sets `container: { build: "bunx vite build", static: dist }` and `up` runs
- **THEN** the build command runs in the `fe` directory and container `v-fe-demo` mounts `fe/dist` read-only into an `nginx:alpine` container

#### Scenario: Replacing a running container

- **WHEN** container `v-be-demo` exists and `up` runs again
- **THEN** the old container is removed and a new one is started with the same port

#### Scenario: Host database from a container

- **WHEN** `db.host` is `host.docker.internal`
- **THEN** the container is started so that `host.docker.internal` resolves to the host and receives that host value unchanged

#### Scenario: Missing engine

- **WHEN** no container engine is available
- **THEN** `up` fails before building or starting anything, naming `docker` and `podman`

### Requirement: Static site proxy

The system SHALL serve a `static` container through a generated web server configuration that answers requests for files, falls back to `index.html` for unknown paths, accepts the host name of the instance's rendered `open` URL, and, when `container.proxy` is set, forwards requests below `proxy.path` to the container `v-<to>-<slug>` at its `container.port`, including WebSocket upgrades. The generated configuration SHALL be removed when the variant is stopped.

#### Scenario: Proxy configuration

- **WHEN** `fe` sets `proxy: { path: /api/, to: be }`, `be` has container port 3000, and the slug is `demo`
- **THEN** the configuration forwards `/api/` to `http://v-be-demo:3000/api/`

#### Scenario: Host name from the open URL

- **WHEN** `fe.open` is `http://{{slug}}.vw.localhost:{{port}}` and the slug is `demo`
- **THEN** the configuration accepts the host `demo.vw.localhost`

#### Scenario: Fallback to index

- **WHEN** a request path matches no file
- **THEN** the configuration serves `index.html`

### Requirement: Watch runs instances as host processes

The system SHALL start the `watch` command of every instance as a process in the instance directory with the command environment, stdout and stderr attached to the console, and SHALL record the process id of each in the runtime state. An instance without a `watch` command SHALL NOT be started; when no instance has one and `variant.watch` is set, that command SHALL run once in the worktree root under the key `variant`. Instances SHALL start in their listed order, waiting `supervise.startDelaySeconds` between two of them. The command SHALL print the command line it runs for each instance.

#### Scenario: Two watchers

- **WHEN** instances `be` and `fe` both have a `watch` command
- **THEN** both processes run in their directories, `be` starts first, and their pids are recorded

#### Scenario: Instance without watch command

- **WHEN** instance `be` has no `watch` command and `fe` has one
- **THEN** only `fe` is started

#### Scenario: Variant-wide command

- **WHEN** no instance has `watch` and `variant.watch` is `bun run dev`
- **THEN** that command runs once in the worktree root under the key `variant`

### Requirement: Watch supervision

The system SHALL keep an attached `watch` running until it is interrupted, an instance process ends, or the worktree directory disappears. On SIGINT or SIGTERM it SHALL terminate every instance process together with its descendants, remove the process ids from the runtime state, and end with exit status 130. When one instance process ends it SHALL terminate the others and end with exit status 1. When the worktree directory disappears (checked every `supervise.checkoutPollSeconds`) it SHALL terminate the processes, drop the variant's database target unless it is the main target, clear the runtime state and end with exit status 1. When `watch` is given the `detach` option it SHALL start the processes detached from the console, write the runtime state, and return without waiting, readiness checks or opening URLs.

#### Scenario: Interrupt

- **WHEN** an attached watch is interrupted with SIGINT
- **THEN** both instance processes and their children are terminated, no pid remains in the runtime state, and the exit status is 130

#### Scenario: One instance dies

- **WHEN** one of two watched processes exits on its own
- **THEN** the other is terminated and the exit status is 1

#### Scenario: Checkout removed

- **WHEN** the worktree directory is deleted while watching and `checkoutPollSeconds` is 1
- **THEN** the processes are terminated, the variant's database target is dropped, and the exit status is 1

#### Scenario: Checkout check disabled

- **WHEN** `checkoutPollSeconds` is 0 and the worktree directory is deleted
- **THEN** the watch keeps running until interrupted or an instance ends

#### Scenario: Detached watch

- **WHEN** `watch` runs with `detach`
- **THEN** the call returns with the pids recorded in `variants.local.yaml` while the processes keep running

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

The system SHALL write the `runtime` section of the variant's `variants.local.yaml` (in the variant's worktree, next to its `variants.yaml`) after instances start: `slug`, `mode` (`up` or `watch`), `dir` (the worktree path), `db` (dialect and target) and, for every instance by key, `port`, the rendered `url` when it has an `open` template and, for host processes, `pid`. Other top-level keys of the file SHALL be kept.

#### Scenario: Written after up

- **WHEN** `up` finishes for slug `demo` with `fe` on port 62060 and an `open` template
- **THEN** `variants.local.yaml` holds `runtime.mode: up`, `runtime.slug: demo` and `runtime.instances.fe` with port 62060 and `url: http://demo.vw.localhost:62060`

#### Scenario: Pids written for watch

- **WHEN** `watch` starts host processes
- **THEN** each instance entry holds the `pid` of its process

#### Scenario: Other keys kept

- **WHEN** the file has another top-level key before `up` runs
- **THEN** that key is unchanged afterwards

### Requirement: Readiness and opening

The system SHALL, after instances start in attached `up` and attached `watch`, poll `http://127.0.0.1:<port><ready>` once per second for every instance that sets `ready`, up to `supervise.readyTimeoutSeconds`. When all answer with a success status it SHALL print the URL of each instance with an `open` template and open each in the system browser, unless opening is disabled. When no instance sets `ready` it SHALL print and open the URLs right after start. On timeout it SHALL print a warning and leave the instances running. Failure to launch a browser SHALL NOT fail the command.

#### Scenario: Open after ready

- **WHEN** `be` has `ready: /health` that starts answering after 2 seconds and `fe` has an `open` template
- **THEN** the URL of `fe` is opened after `be` answers

#### Scenario: Open disabled

- **WHEN** `variant.open` is `false`
- **THEN** URLs are printed and no browser is launched

#### Scenario: Ready timeout

- **WHEN** an instance never answers within `readyTimeoutSeconds`
- **THEN** a warning is printed, no URL is opened, and the instances keep running

### Requirement: Down

The system SHALL provide `down` for a slug that stops every recorded host process with its descendants, removes the variant's containers, its network and its generated web server configurations, and removes the `runtime` section from `variants.local.yaml` while keeping other top-level keys. It SHALL keep the database target, the storage directory and the variant state, and SHALL work for slug `main`. A variant that has nothing running SHALL succeed without changes.

#### Scenario: Down after watch

- **WHEN** slug `demo` runs a detached watch and `down` runs for `demo`
- **THEN** the processes are terminated and the file has no `runtime` section

#### Scenario: Down after up

- **WHEN** slug `demo` runs containers and `down` runs
- **THEN** the containers and network `v-net-demo` are removed and the database target still exists

#### Scenario: Nothing running

- **WHEN** `down` runs for a slug with no runtime state
- **THEN** the call succeeds and reports nothing stopped

#### Scenario: Stale pid

- **WHEN** the recorded pid no longer exists
- **THEN** `down` ignores it and still clears the runtime state

### Requirement: Container command echo

The system SHALL print the line `+ <command>` to the progress log before it runs each command of the container runtime that changes state: an instance `container.build`, an image build, a network create or remove, and a container remove or run. The engine commands SHALL be printed as the engine name followed by its arguments, and the value of every `-e NAME=value` argument SHALL be printed as `-e NAME=***`. Read-only `inspect` calls SHALL NOT be printed. The progress log SHALL be the `log` callback of the caller and SHALL default to standard error. This applies to `up`, to `down` and to the stop that `watch`, `up` and `implode` run first.

#### Scenario: Up prints its engine commands

- **WHEN** `up` starts an instance with a `container.build` and an image
- **THEN** the progress log receives the build command, then `+ <engine> network create`, then `+ <engine> run ...`

#### Scenario: Environment values are hidden

- **WHEN** `up` starts a container whose environment includes `POSTGRES_PASSWORD=secret`
- **THEN** the printed line holds `-e POSTGRES_PASSWORD=***` and no line holds `secret`

#### Scenario: Down prints its engine commands

- **WHEN** `down` removes a container and its network
- **THEN** the progress log receives `+ <engine> rm -f <container>` and `+ <engine> network rm <network>`

### Requirement: Watch without commands

The system SHALL print a warning to the progress log when `watch` starts no process because no instance has a `watch` command and `variant.watch` is not set. The warning SHALL say that nothing was started and name `watch` on an instance and `variant.watch` as the ways to set a command. The command SHALL otherwise behave as before.

#### Scenario: Nothing to start

- **WHEN** `watch` runs for instances that have no `watch` command and `variant.watch` is not set
- **THEN** the progress log receives a warning that no process was started and names `watch` and `variant.watch`

#### Scenario: Commands present

- **WHEN** at least one instance has a `watch` command
- **THEN** no such warning is printed
