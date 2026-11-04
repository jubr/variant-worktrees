## MODIFIED Requirements

### Requirement: Local runtime state

The system SHALL read ephemeral per-variant state from `variants.local.yaml` next to `variants.yaml`, in the variant's own worktree (`<prefix><slug>/variants.local.yaml`), and carry it as `runtime` in the resolved configuration. The file holds one optional `runtime` section with `slug`, `mode` (`up` or `watch`), `dir`, `log` (the path of the log file of a detached watch), `createdAt`, `db` and `watches`. `createdAt`, when present, SHALL match `YYYY-MM-DD_HH:MM:SS`: a zero-padded local date, an underscore, and a zero-padded 24-hour time, with no timezone suffix. `db` SHALL reuse the database settings schema, except that `port` MAY also be a string: digits, or a `${NAME}` template. `watches` SHALL be a record keyed by watch key (the key of the entry in `variant.watches`); each entry holds optional `port`, `pid`, `url` and `startedAt`. `startedAt`, when present, SHALL match the same `YYYY-MM-DD_HH:MM:SS` form as `createdAt`. Every `${NAME}` in a string SHALL be replaced by the environment variable `NAME` when the file is read; an unset variable leaves the template unchanged, and a `db.port` that is then not numeric SHALL be left out of the resolved state. Unknown keys SHALL fail validation: the file is written by the system, so an unknown key means a version mismatch rather than a typo. A `runtime.instances` record written by an earlier version SHALL be read as `watches`. A missing file SHALL mean no runtime state. The system SHALL offer a function that writes the `runtime` section, validated, keeping any other top-level keys, and the repository SHALL git-ignore `variants.local.yaml`. A JSON schema file `variants.local.yaml.schema.json` and `variants.local.example.yaml` SHALL ship next to the main ones under the same rules.

#### Scenario: Runtime read

- **WHEN** `variants.local.yaml` sets `runtime.slug: demo` and `runtime.watches.fe.port: 62060`
- **THEN** the resolved configuration carries `runtime.slug` `demo` and an `fe` port of 62060

#### Scenario: Created time read

- **WHEN** `variants.local.yaml` sets `runtime.createdAt: 2026-11-04_12:22:05`
- **THEN** the resolved runtime state carries that `createdAt`

#### Scenario: Start time read

- **WHEN** `variants.local.yaml` sets `runtime.watches.fe.startedAt: 2026-11-04_12:30:00`, `pid: 123` and a `url`
- **THEN** the resolved `fe` watch carries that `startedAt`, `pid` and `url`

#### Scenario: Database port from the environment

- **WHEN** `runtime.db.port` is `'${POSTGRES_PORT}'` and `POSTGRES_PORT` is `5433`
- **THEN** the resolved `runtime.db.port` is 5433

#### Scenario: Unset environment variable

- **WHEN** `runtime.db.port` is `'${POSTGRES_PORT}'` and `POSTGRES_PORT` is unset
- **THEN** the resolved runtime state has no `db.port`

#### Scenario: Reused database schema

- **WHEN** `runtime.db` sets `schema: v_demo` and `dialect: postgres`
- **THEN** they validate with the rules of `db`, and `runtime.db.port: -1` fails validation

#### Scenario: Log path read

- **WHEN** `variants.local.yaml` sets `runtime.log: /work/_v-demo/variants.watch.log`
- **THEN** the resolved runtime state carries that `log`

#### Scenario: No local file

- **WHEN** no `variants.local.yaml` exists
- **THEN** the resolved configuration has no runtime state

#### Scenario: Legacy instances record

- **WHEN** `variants.local.yaml` sets `runtime.instances.fe.port: 62060` and no `runtime.watches`
- **THEN** the resolved configuration carries a `watches` record with an `fe` port of 62060, and the next write of the runtime section stores `watches`

#### Scenario: Invalid local file

- **WHEN** `runtime` holds an unknown key, `watches.fe.pid` is `0`, or `createdAt` or `startedAt` is not `YYYY-MM-DD_HH:MM:SS`
- **THEN** loading the configuration fails validation

#### Scenario: Writing the runtime section

- **WHEN** the runtime section is written to a directory whose `variants.local.yaml` has other top-level keys
- **THEN** the file holds the new `runtime` and the other keys unchanged
