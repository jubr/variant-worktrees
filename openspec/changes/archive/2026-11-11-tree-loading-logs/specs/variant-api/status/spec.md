## MODIFIED Requirements

### Requirement: Uptime and watch log

A variant record, in `status` and in `list`, SHALL carry `uptimeSeconds` when at least one of its watches has a recorded pid whose process is alive: the longest time any such process has been running, taken from the system process table. Each watch with such a process SHALL carry its own `uptimeSeconds`. A variant record SHALL carry `log`, the absolute path of the log file of its watch, when the runtime state records one. A variant without a live recorded process (for example one started with `up`) SHALL have no `uptimeSeconds`.

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

#### Scenario: Attached watch log

- **WHEN** the runtime state of an attached watch records `log` as `/work/_v-demo/.cache/variant/watch.log`
- **THEN** the status record has `log` `/work/_v-demo/.cache/variant/watch.log`

#### Scenario: Up has no uptime

- **WHEN** variant `demo` was started with `up` and records no pids
- **THEN** its record has no `uptimeSeconds` and no `log`
