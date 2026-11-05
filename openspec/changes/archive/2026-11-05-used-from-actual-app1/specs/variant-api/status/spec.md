## MODIFIED Requirements

### Requirement: Status carries the runtime meta information

The `runtime` object of a status result SHALL hold the operational state of the variant's `.cache/variant/state.yaml` and, when `.cache/variant/runtime.yaml` exists, the database settings from that dump. `${NAME}` templates SHALL be replaced as when discovering runtime states (the `VARIANT_<KEY>_*` overrides describe only the variant being run and do not apply). The object SHALL include `slug`, `mode`, `dir`, `log`, `createdAt`, `db`, and `watches` with each watch's `port`, `pid`, `url`, `startedAt`, `alive` (set when a pid is recorded) and `uptimeSeconds`. `db.dialect` SHALL be the state file's `dialect`, and `db.schema` or the database filename SHALL be the state file's `target`, completed from the detection dump when that dump has those settings. It SHALL also hold `file`, the path of `.cache/variant/state.yaml`. The `db.password` value SHALL be shown as `***` in every output format. A variant with no operational state SHALL have no `runtime` object.

#### Scenario: Full runtime section

- **WHEN** the state file of `demo` records mode `up`, `dir`, `dialect` `postgres`, `target` `v_demo`, and watch `be` with port 62061
- **THEN** `runtime.mode`, `runtime.dir`, `runtime.db.dialect`, `runtime.db.schema` and `runtime.watches.be.port` carry those values and `runtime.file` is the path of that `state.yaml`

#### Scenario: Created and start times

- **WHEN** the state file records `createdAt: 2026-11-04_12:22:05` and watch `fe` records `startedAt: 2026-11-04_12:30:00`
- **THEN** `runtime.createdAt` and `runtime.watches.fe.startedAt` carry those values

#### Scenario: Liveness

- **WHEN** a watch records a pid and no process with that id exists
- **THEN** that watch has `alive: false`

#### Scenario: Password redacted

- **WHEN** `runtime.yaml` records `db.password` `secret`
- **THEN** no output format of `variant status` contains `secret`, and `db.password` is `***`

#### Scenario: Environment overrides do not apply

- **WHEN** `VARIANT_FE_PORT` is `62070` and the state file records port 62060 for `fe`
- **THEN** `runtime.watches.fe.port` is 62060

#### Scenario: No runtime state

- **WHEN** variant `demo` has a state file but no operational watch state
- **THEN** the status result has no `mode`
