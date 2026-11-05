## ADDED Requirements

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

## MODIFIED Requirements

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

### Requirement: Detached watch log

A `watch` with the `detach` option SHALL write the stdout and stderr of every process it starts, interleaved as they are produced, to one log file named `variants.watch.log` in the variant directory (git-ignored, removed with the worktree). It SHALL truncate that file when it starts, write the line `[<key>] <command>` for each process before it starts, and record the absolute path as `log` in `.cache/variant/state.yaml`. Output SHALL reach the file while the processes run, so a reader can follow it with `tail -f`. An attached `watch` SHALL keep its output on the console, write no log file, and record no `log`. `down` SHALL remove `log` from the state file and keep the file. `up` SHALL write no log file.

#### Scenario: Detached output reaches the file

- **WHEN** `watch` runs detached with a command that prints `ready` and keeps running
- **THEN** `variants.watch.log` contains `ready` while the process still runs

#### Scenario: Log path recorded

- **WHEN** `watch` runs detached for slug `demo`
- **THEN** `state.yaml` holds `log` with the absolute path of `variants.watch.log`

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
