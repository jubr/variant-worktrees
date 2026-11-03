# variant-api/status Specification

## Purpose
The `status` command answers what one variant is doing right now: what `list` knows about it plus everything its runtime state records, without opening `variants.local.yaml` by hand.

## Requirements

### Requirement: Status command

The system SHALL provide a `status` command that takes the optional `slug` argument, resolved like every other command (explicit slug, else the current git worktree), and returns the record of that single variant. The record SHALL hold the facts `list` returns for the variant (`slug`, `target`, `dialect`, `statePath`, `worktree`, `createdAt`, `exists`, and, when a runtime state exists, `mode`, `url`, `watches`, `uptimeSeconds` and `log`) and a `runtime` object. The command SHALL fail with an error naming the slug when no state file, database target or runtime state exists for it. It SHALL NOT change any state.

#### Scenario: Status of a running variant

- **WHEN** variant `demo` has a state file and a runtime state with mode `watch` and watch `fe` on port 62060 with pid 123, and a user runs `variant status demo`
- **THEN** the result has `slug` `demo`, `mode` `watch`, and `watches.fe.port` 62060

#### Scenario: Slug from the worktree

- **WHEN** a user runs `variant status` inside the worktree `_v-demo`
- **THEN** the result is the status of slug `demo`

#### Scenario: Unknown slug

- **WHEN** no state file, database target or runtime state exists for `ghost` and a user runs `variant status ghost`
- **THEN** the command fails with an error that names `ghost` and the process exits non-zero

#### Scenario: Only one variant

- **WHEN** variants `alpha` and `beta` exist and a user runs `variant status alpha`
- **THEN** the result describes `alpha` only

### Requirement: Status carries the runtime meta information

The `runtime` object of a status result SHALL hold every value of the `runtime` section of the variant's `variants.local.yaml`, with `{{NAME}}` templates replaced as when discovering runtime states (the `VARIANT_<KEY>_*` overrides describe only the variant being run and do not apply): `slug`, `mode`, `dir`, `log`, `db`, and `watches` with each watch's `port`, `pid`, `url`, `alive` (set when a pid is recorded) and `uptimeSeconds`. It SHALL also hold `file`, the path of the runtime file it was read from. The `db.password` value SHALL be shown as `***` in every output format. A variant with no runtime state SHALL have no `runtime` object.

#### Scenario: Full runtime section

- **WHEN** the runtime state of `demo` records mode `up`, `dir`, `db.dialect` `postgres`, `db.schema` `v_demo`, and watch `be` with port 62061
- **THEN** `runtime.mode`, `runtime.dir`, `runtime.db.dialect`, `runtime.db.schema` and `runtime.watches.be.port` carry those values and `runtime.file` is the path of that `variants.local.yaml`

#### Scenario: Liveness

- **WHEN** a watch records a pid and no process with that id exists
- **THEN** that watch has `alive: false`

#### Scenario: Password redacted

- **WHEN** the runtime state records `db.password` `secret`
- **THEN** no output format of `variant status` contains `secret`, and `db.password` is `***`

#### Scenario: Environment overrides do not apply

- **WHEN** `VARIANT_FE_PORT` is `62070` and the runtime state records port 62060 for `fe`
- **THEN** `runtime.watches.fe.port` is 62060

#### Scenario: No runtime state

- **WHEN** variant `demo` has a state file but no runtime state
- **THEN** the status result has no `runtime` object and no `mode`

### Requirement: Uptime and watch log

A variant record, in `status` and in `list`, SHALL carry `uptimeSeconds` when at least one of its watches has a recorded pid whose process is alive: the longest time any such process has been running, taken from the system process table. Each watch with such a process SHALL carry its own `uptimeSeconds`. A variant record SHALL carry `log`, the absolute path of the log file of its detached watch, when the runtime state records one. A variant without a live recorded process (for example one started with `up`) SHALL have no `uptimeSeconds`.

#### Scenario: Uptime of a watch

- **WHEN** watch `fe` has a recorded pid whose process started 90 seconds ago
- **THEN** `watches.fe.uptimeSeconds` is about 90 and the variant `uptimeSeconds` is at least that of `fe`

#### Scenario: Longest process wins

- **WHEN** `be` has run for 300 seconds and `fe` for 90 seconds
- **THEN** the variant `uptimeSeconds` is about 300

#### Scenario: Dead pid has no uptime

- **WHEN** the recorded pid of a watch belongs to no process
- **THEN** that watch has `alive: false` and no `uptimeSeconds`, and the variant has no `uptimeSeconds` from it

#### Scenario: Log path

- **WHEN** the runtime state records `log` as `/work/_v-demo/variants.watch.log`
- **THEN** the status record has `log` `/work/_v-demo/variants.watch.log`

#### Scenario: Up has no uptime

- **WHEN** variant `demo` was started with `up` and records no pids
- **THEN** its record has no `uptimeSeconds` and no `log`
