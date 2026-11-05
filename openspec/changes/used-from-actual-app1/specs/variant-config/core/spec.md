## ADDED Requirements

### Requirement: Worktree configuration file

When the process working directory is inside a variant worktree, and that worktree directory contains `variants.yaml` or `variants.yml`, that file SHALL be the loaded configuration. A variant worktree is a git worktree that is not the primary checkout, or a directory under the variant root whose name starts with the resolved prefix. The search SHALL NOT leave that worktree to use an ancestor file or the file reached through an `AGENTS.md` symlink. When that file defines `variant.watches`, those watches SHALL be the resolved watches and watch autodetection SHALL NOT run. When the worktree directory contains neither file, discovery SHALL keep its existing ancestor walk and `AGENTS.md` fallback.

#### Scenario: Worktree file wins

- **WHEN** `/work/_v-demo/variants.yaml` defines `variant.watches.api` and `variant.watches.spa`, `/work/app/variants.yaml` defines no watches, and the process working directory is `/work/_v-demo`
- **THEN** the loaded file is `/work/_v-demo/variants.yaml`
- **AND** the resolved watches are `api` and `spa` from that file

#### Scenario: Parent symlink does not redirect

- **WHEN** the process working directory is `/work/_v-demo`, `/work/_v-demo/variants.yaml` exists, and `/work/AGENTS.md` is a symlink into `/work/app`
- **THEN** the loaded file is `/work/_v-demo/variants.yaml` and not `/work/app/variants.yaml`

#### Scenario: Subdirectory of the worktree

- **WHEN** the process working directory is `/work/_v-demo/server` and `/work/_v-demo/variants.yaml` exists
- **THEN** the loaded file is `/work/_v-demo/variants.yaml`

#### Scenario: No file in the worktree

- **WHEN** `/work/_v-demo` has no `variants.yaml` and `/work/app/variants.yaml` is the file an `AGENTS.md` symlink in `/work` names
- **THEN** discovery uses that existing fallback and loads `/work/app/variants.yaml`

#### Scenario: Explicit watches are not autodetected

- **WHEN** the loaded worktree file defines `variant.watches` and the primary checkout's file does not
- **THEN** the resolved watches are the worktree file's watches and are not `bun run dev` or `bun run start:dev` taken from the primary checkout

## MODIFIED Requirements

### Requirement: variants.yaml schema

The system SHALL validate `variants.yaml` against a JSON schema at parse time. A key that the schema does not define (an extra property) SHALL NOT fail validation: it SHALL be ignored and reported as a warning that names the file and the path of the key. Every other violation (a wrong type, a value out of range, a missing required key, a failed cross-field rule) SHALL fail validation, and its errors SHALL be reported together with the warnings. The warnings SHALL be part of the resolved configuration. `db.port` SHALL be a positive integer or a string. A string of digits, and a string that is a single `${NAME}` template, SHALL pass validation. When the environment variable named by that template is a positive integer, the resolved `db.port` SHALL be that integer. A string that is neither digits nor a single `${NAME}` template, and a template whose variable is set to a value that is not a positive integer, SHALL fail validation with the expected type. The published JSON schema for `variants.yaml` SHALL accept both an integer and a string for `db.port`.

#### Scenario: Valid config file
- **WHEN** a workspace has `variants.yaml` with `db.host`, `db.port`, `db.user`, `db.password`, and `db.database` keys
- **THEN** the parser returns a typed config object

#### Scenario: Missing required field
- **WHEN** `variants.yaml` omits `db.host` from an explicit non-SQLite database config
- **THEN** validation throws an error with the field name and location

#### Scenario: Invalid type
- **WHEN** `db.port` is the string `"not-a-number"`
- **THEN** validation throws an error with the expected type

#### Scenario: Port from a variable

- **WHEN** `variants.yaml` sets `db.port: ${POSTGRES_PORT}` and `POSTGRES_PORT` is `5432`
- **THEN** loading succeeds and the resolved `db.port` is `5432`

#### Scenario: Published schema allows a string port

- **WHEN** the published JSON schema for `variants.yaml` is read
- **THEN** `db.port` accepts an integer and a string

#### Scenario: Extra property warns
- **WHEN** `variants.yaml` sets `db.colour: red` next to valid settings
- **THEN** loading succeeds, the resolved configuration has no `colour` and carries one warning that names `db.colour`

#### Scenario: Extra property next to an error
- **WHEN** `variants.yaml` sets `db.colour: red` and `db.port: "abc"`
- **THEN** loading fails with the error for `db.port`, and the warning for `db.colour` is reported with it

#### Scenario: Warnings reach the user
- **WHEN** a user runs a `variant` command and `variants.yaml` has an extra property
- **THEN** stderr shows a line starting `warning:` that names the file and the key, and the command runs as usual

### Requirement: Config CLI command

The system SHALL provide a `variant config` command that prints detected config as JSON. The printed JSON SHALL include the resolved `variant.main` and `variant.root` when those paths are known, including when `variants.yaml` omits both keys.

#### Scenario: Print detected config
- **WHEN** a user runs `variant config`
- **THEN** stdout is JSON with `db` and `variants` sections

#### Scenario: Validation error reporting
- **WHEN** a user runs `variant config` and `variants.yaml` is invalid
- **THEN** stderr shows the validation error and the exit code is 1

#### Scenario: Resolved main and root

- **WHEN** `variants.yaml` sets neither `variant.main` nor `variant.root` and a user runs `variant config`
- **THEN** the printed JSON includes the resolved `variant.main` and `variant.root`

### Requirement: Local runtime state

The system SHALL keep a variant's operational state in `<variant>/.cache/variant/state.yaml` and a dump of the resolved runtime detection in `<variant>/.cache/variant/runtime.yaml`. `<variant>` is the worktree directory, or the main checkout when the slug is `main`. The system SHALL NOT write `variants.local.yaml` or `.cache/variants/<slug>.yaml`.

`state.yaml` SHALL hold only `slug`, `createdAt`, `dir`, `dialect`, `target`, and, when known, `mode` (`up` or `watch`), `log`, and `watches`. `createdAt` and each watch `startedAt`, when present, SHALL match `YYYY-MM-DD_HH:MM:SS`: a zero-padded local date, an underscore, and a zero-padded 24-hour time, with no timezone suffix. `watches` SHALL be a record keyed by watch key; each entry holds optional `port`, `pid`, `url` and `startedAt`. `state.yaml` SHALL NOT hold a database password or a watch command. `runtime.yaml` SHALL hold the resolved detection written whenever operational state is written: the resolved database settings, the resolved watches (directory, command, port, pid and url), and the configuration path. A database password MAY be present in `runtime.yaml`.

Both files SHALL be written only when their serialized content would change. An unchanged write SHALL leave the file and its modification time alone. Unknown keys in `state.yaml` SHALL fail validation of that file. A missing `state.yaml` SHALL mean no operational state for that directory, except the legacy read below. The repository SHALL git-ignore `.cache/`.

When `state.yaml` is absent, the system SHALL still read a `variants.local.yaml` in that directory, and a `.cache/variants/<slug>.yaml` whose slug is that variant, and SHALL NOT write either legacy file. A `runtime.instances` record in a legacy file SHALL be read as `watches`. Every `${NAME}` in a string of a legacy file SHALL be replaced by the environment variable `NAME` when the file is read; an unset variable leaves the template unchanged, and a `db.port` that is then not numeric SHALL be left out of the resolved state.

#### Scenario: State read

- **WHEN** `.cache/variant/state.yaml` sets `slug: demo` and `watches.fe.port: 62060`
- **THEN** the resolved operational state carries slug `demo` and an `fe` port of 62060

#### Scenario: Runtime read

- **WHEN** `.cache/variant/state.yaml` sets `slug: demo` and `watches.fe.port: 62060`
- **THEN** the resolved operational state carries slug `demo` and an `fe` port of 62060

#### Scenario: Created time read

- **WHEN** `state.yaml` sets `createdAt: 2026-11-04_12:22:05`
- **THEN** the resolved operational state carries that `createdAt`

#### Scenario: Start time read

- **WHEN** `state.yaml` sets `watches.fe.startedAt: 2026-11-04_12:30:00`, `pid: 123` and a `url`
- **THEN** the resolved `fe` watch carries that `startedAt`, `pid` and `url`

#### Scenario: Detection dump

- **WHEN** a watch is recorded for slug `demo`
- **THEN** `runtime.yaml` in that variant directory holds the resolved database settings, the watch command, and the configuration path

#### Scenario: Write on change

- **WHEN** the operational state is written twice with the same content
- **THEN** the second write leaves the modification time of `state.yaml` unchanged

#### Scenario: Log path read

- **WHEN** `state.yaml` sets `log: /work/_v-demo/variants.watch.log`
- **THEN** the resolved operational state carries that `log`

#### Scenario: No state file

- **WHEN** a variant directory has no `.cache/variant/state.yaml` and no legacy file
- **THEN** that directory contributes no operational state

#### Scenario: No local file

- **WHEN** no `state.yaml` and no legacy file exist
- **THEN** the resolved configuration has no runtime state

#### Scenario: Database port from the environment

- **WHEN** a legacy `runtime.db.port` is `'${POSTGRES_PORT}'` and `POSTGRES_PORT` is `5433`
- **THEN** the resolved port is 5433

#### Scenario: Unset environment variable

- **WHEN** a legacy `runtime.db.port` is `'${POSTGRES_PORT}'` and `POSTGRES_PORT` is unset
- **THEN** the resolved state has no port for that database

#### Scenario: Reused database schema

- **WHEN** `state.yaml` sets `dialect: postgres` and `target: v_demo`
- **THEN** they validate, and a `port` of `-1` in a legacy `runtime.db` fails validation

#### Scenario: Invalid local file

- **WHEN** `state.yaml` holds an unknown key, `watches.fe.pid` is `0`, or `createdAt` or `startedAt` is not `YYYY-MM-DD_HH:MM:SS`
- **THEN** loading that file fails validation

#### Scenario: Writing the runtime section

- **WHEN** operational state is written for a variant
- **THEN** `state.yaml` holds that state and `variants.local.yaml` is not created

#### Scenario: Legacy file still read

- **WHEN** a variant directory has no `state.yaml` and has `variants.local.yaml` with `runtime.slug: demo` and `runtime.watches.fe.port: 62060`
- **THEN** the resolved operational state carries slug `demo` and an `fe` port of 62060
- **AND** the read does not create `variants.local.yaml` or change it

#### Scenario: Legacy instances record

- **WHEN** a legacy `variants.local.yaml` sets `runtime.instances.fe.port: 62060` and no `runtime.watches`, and `state.yaml` is absent
- **THEN** the resolved operational state carries a `watches` record with an `fe` port of 62060

#### Scenario: Invalid state file

- **WHEN** `state.yaml` holds an unknown key, `watches.fe.pid` is `0`, or `createdAt` or `startedAt` is not `YYYY-MM-DD_HH:MM:SS`
- **THEN** loading that file fails validation

#### Scenario: Old paths are not written

- **WHEN** create or watch records state for slug `demo`
- **THEN** `.cache/variant/state.yaml` exists in the variant directory and `variants.local.yaml` is not created

### Requirement: Example configuration

The package SHALL ship `variants.example.yaml` next to `variants.yaml.schema.json`, specifying every option of the schema with an illustrative default and listing alternatives in end-of-line comments. The example SHALL validate against the schema, and a test SHALL fail when the schema holds an option the example omits. The package is not required to ship `variants.local.example.yaml`.

#### Scenario: Example validates

- **WHEN** `variants.example.yaml` is parsed and validated
- **THEN** validation succeeds

#### Scenario: Example covers the schema

- **WHEN** an option is added to the schema and not to the example
- **THEN** the coverage test fails and names the missing option

### Requirement: Schema header

A `variants.yaml` SHALL begin with a `yaml-language-server` modeline that names the JSON schema of the file, so editors offer completion and validation: `# yaml-language-server: $schema=https://github.com/jubr/variant-worktrees/raw/refs/heads/main/packages/variant-config/variants.yaml.schema.json`, followed by a blank line. `.cache/variant/state.yaml` and `.cache/variant/runtime.yaml` SHALL NOT carry that modeline. The system SHALL NOT create `variants.local.yaml`. A `variants.yaml` without any `$schema` modeline SHALL count as needing a migration: the function that returns the migrated text (see `Legacy configuration is read under the current names`) is joined by a function that adds the header, and the file migration of the `variant` command and the extension SHALL add it under the same rules as a rename. Loading SHALL NOT write the header and SHALL NOT report it as a migration notice of the resolved configuration. An empty file, a file of comments only and a file that is not a YAML mapping SHALL NOT get a header.

#### Scenario: Cache files have no modeline

- **WHEN** the system writes `.cache/variant/state.yaml` where none exists
- **THEN** the file does not begin with a `yaml-language-server` modeline

#### Scenario: New local state file

- **WHEN** the system writes `.cache/variant/state.yaml` where none exists
- **THEN** the file does not begin with a `yaml-language-server` modeline

#### Scenario: Existing schema line kept

- **WHEN** a `variants.yaml` begins with `# yaml-language-server: $schema=./mine.json`
- **THEN** that line is still the first line afterwards and no second schema line is added

#### Scenario: Header added to a file without one

- **WHEN** the migration processes a `variants.yaml` that has no `$schema` modeline
- **THEN** the modeline of the main schema and a blank line are placed above the first line

#### Scenario: Own schema line left alone

- **WHEN** a `variants.yaml` begins with `# yaml-language-server: $schema=./packages/variant-config/variants.yaml.schema.json`
- **THEN** the migration changes nothing

#### Scenario: Nothing to annotate

- **WHEN** the file is empty, holds only comments or is invalid YAML
- **THEN** no header is added
