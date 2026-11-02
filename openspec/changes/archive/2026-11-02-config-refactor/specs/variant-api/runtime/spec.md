## MODIFIED Requirements

### Requirement: Up runs instances as containers

The system SHALL start every instance that has a `container` as a container named `v-<key>-<slug>` on a network named `v-net-<slug>`, creating the network when missing and replacing a container of that name that already exists. The image SHALL be built from `container.dockerfile` with the worktree as context into `v-<key>:v-<slug>`, so a Dockerfile can build and serve an instance on its own. The container SHALL publish the instance's assigned port, on all interfaces, to `container.internalPort` (80 when it is not set). The container SHALL receive as environment the variant variables of the command environment: the database connection settings with the host unchanged, the database target variable, `VARIANT_SLUG`, `VARIANT_TARGET` and `VARIANT_<K>_PORT` and `VARIANT_<K>_URL` of every instance. It SHALL NOT receive the instance `env.overrides`, which describe the host process, and SHALL NOT receive `SQLITE_DATABASE` or the storage variable, which hold host paths. When the database host is `host.docker.internal`, the container SHALL be able to resolve it to the host. A container SHALL reach another container of the variant by the name `v-<key>-<slug>` on the shared network. Instances SHALL start in their listed order, waiting `supervise.startDelaySeconds` between two of them. An instance without `container` SHALL NOT be started by `up`.

#### Scenario: Application container

- **WHEN** instance `be` sets `container: { dockerfile: be/Dockerfile, internalPort: 3000 }` and `up` runs for slug `demo` with assigned port 62061
- **THEN** the engine builds `v-be:v-demo`, creates network `v-net-demo` and runs container `v-be-demo` publishing `0.0.0.0:62061` to container port 3000

#### Scenario: Static site

- **WHEN** instance `fe` sets `container: { dockerfile: fe/Dockerfile }` and `up` runs with assigned port 62060
- **THEN** container `v-fe-demo` publishes `0.0.0.0:62060` to container port 80 and no build command runs on the host

#### Scenario: Container environment

- **WHEN** `be` sets `env: { overrides: { PORT: "{{port}}" } }` and `up` starts its container
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

### Requirement: Watch runs instances as host processes

The system SHALL start the `watch` command of every instance as a process in the instance directory with the command environment, stdout and stderr attached to the console, and SHALL record the process id of each in the runtime state. An instance without a `watch` command SHALL NOT be started. Instances SHALL start in their listed order, waiting `supervise.startDelaySeconds` between two of them. The command SHALL print the command line it runs for each instance.

#### Scenario: Two watchers

- **WHEN** instances `be` and `fe` both have a `watch` command
- **THEN** both processes run in their directories, `be` starts first, and their pids are recorded

#### Scenario: Instance without watch command

- **WHEN** instance `be` has no `watch` command and `fe` has one
- **THEN** only `fe` is started

#### Scenario: Variant-wide command

- **WHEN** no instance has `watch`
- **THEN** no process is started, whatever else the configuration holds

### Requirement: Runtime state recording

The system SHALL write the `runtime` section of the variant's `variants.local.yaml` (in the variant's worktree, next to its `variants.yaml`) after instances start: `slug`, `mode` (`up` or `watch`), `dir` (the worktree path), `db` (dialect and target) and, for every instance by key, `port`, the rendered `url` when it has a `url` template and, for host processes, `pid`. Other top-level keys of the file SHALL be kept.

#### Scenario: Written after up

- **WHEN** `up` finishes for slug `demo` with `fe` on port 62060 and a `url` template
- **THEN** `variants.local.yaml` holds `runtime.mode: up`, `runtime.slug: demo` and `runtime.instances.fe` with port 62060 and `url: http://demo.vw.localhost:62060`

#### Scenario: Pids written for watch

- **WHEN** `watch` starts host processes
- **THEN** each instance entry holds the `pid` of its process

#### Scenario: Other keys kept

- **WHEN** the file has another top-level key before `up` runs
- **THEN** that key is unchanged afterwards

### Requirement: Readiness and opening

The system SHALL, after instances start in attached `up` and attached `watch`, poll `http://127.0.0.1:<port><ready>` once per second for every instance that sets `ready`, up to `supervise.readyTimeoutSeconds`. When all answer with a success status it SHALL print the URL of each instance with a `url` template and open each in the system browser, unless opening is disabled. When no instance sets `ready` it SHALL print and open the URLs right after start. On timeout it SHALL print a warning and leave the instances running. Failure to launch a browser SHALL NOT fail the command.

#### Scenario: Open after ready

- **WHEN** `be` has `ready: /health` that starts answering after 2 seconds and `fe` has a `url` template
- **THEN** the URL of `fe` is opened after `be` answers

#### Scenario: Open disabled

- **WHEN** `variant.open` is `false`
- **THEN** URLs are printed and no browser is launched

#### Scenario: Ready timeout

- **WHEN** an instance never answers within `readyTimeoutSeconds`
- **THEN** a warning is printed, no URL is opened, and the instances keep running

### Requirement: Down

The system SHALL provide `down` for a slug that stops every recorded host process with its descendants, removes the variant's containers and its network, and removes the `runtime` section from `variants.local.yaml` while keeping other top-level keys. It SHALL keep the database target, the storage directory and the variant state, and SHALL work for slug `main`. A variant that has nothing running SHALL succeed without changes.

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

The system SHALL print the line `+ <command>` to the progress log before it runs each command of the container runtime that changes state: an image build, a network create or remove, and a container remove or run. The engine commands SHALL be printed as the engine name followed by its arguments, and the value of every `-e NAME=value` argument SHALL be printed as `-e NAME=***`. Read-only `inspect` calls SHALL NOT be printed. The progress log SHALL be the `log` callback of the caller and SHALL default to standard error. This applies to `up`, to `down` and to the stop that `watch`, `up` and `implode` run first.

#### Scenario: Up prints its engine commands

- **WHEN** `up` starts an instance with a `container`
- **THEN** the progress log receives `+ <engine> build ...`, then `+ <engine> network create`, then `+ <engine> run ...`

#### Scenario: Environment values are hidden

- **WHEN** `up` starts a container whose environment includes `POSTGRES_PASSWORD=secret`
- **THEN** the printed line holds `-e POSTGRES_PASSWORD=***` and no line holds `secret`

#### Scenario: Down prints its engine commands

- **WHEN** `down` removes a container and its network
- **THEN** the progress log receives `+ <engine> rm -f <container>` and `+ <engine> network rm <network>`

### Requirement: Watch without commands

The system SHALL print a warning to the progress log when `watch` starts no process because no instance has a `watch` command. The warning SHALL say that nothing was started and name `watch` on an instance as the way to set a command. The command SHALL otherwise behave as before.

#### Scenario: Nothing to start

- **WHEN** `watch` runs for instances that have no `watch` command
- **THEN** the progress log receives a warning that no process was started and names `watch`

#### Scenario: Commands present

- **WHEN** at least one instance has a `watch` command
- **THEN** no such warning is printed

## REMOVED Requirements

### Requirement: Static site proxy

**Reason**: The system no longer generates a web server configuration. A static site is an ordinary container whose Dockerfile builds the files, serves them and proxies the API path.

**Migration**: Move the web server configuration, including any proxy to the `v-<key>-<slug>` container of another instance, into the instance's Dockerfile (see `example/fe/Dockerfile`), and replace `container.static`, `container.build`, `container.proxy` and `container.env` with `container.dockerfile`.
