## MODIFIED Requirements

### Requirement: Status carries the runtime meta information

The `runtime` object of a status result SHALL hold every value of the `runtime` section of the variant's `variants.local.yaml`, with `${NAME}` templates replaced as when discovering runtime states (the `VARIANT_<KEY>_*` overrides describe only the variant being run and do not apply): `slug`, `mode`, `dir`, `log`, `createdAt`, `db`, and `watches` with each watch's `port`, `pid`, `url`, `startedAt`, `alive` (set when a pid is recorded) and `uptimeSeconds`. It SHALL also hold `file`, the path of the runtime file it was read from. The `db.password` value SHALL be shown as `***` in every output format. A variant with no runtime state SHALL have no `runtime` object.

#### Scenario: Full runtime section

- **WHEN** the runtime state of `demo` records mode `up`, `dir`, `db.dialect` `postgres`, `db.schema` `v_demo`, and watch `be` with port 62061
- **THEN** `runtime.mode`, `runtime.dir`, `runtime.db.dialect`, `runtime.db.schema` and `runtime.watches.be.port` carry those values and `runtime.file` is the path of that `variants.local.yaml`

#### Scenario: Created and start times

- **WHEN** the runtime state records `createdAt: 2026-11-04_12:22:05` and watch `fe` records `startedAt: 2026-11-04_12:30:00`
- **THEN** `runtime.createdAt` and `runtime.watches.fe.startedAt` carry those values

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
