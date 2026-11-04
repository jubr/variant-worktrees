# variant-api/multi-schema Specification

## Purpose

A variant can own one PostgreSQL schema per tenant. The project supplies the scripts that create the schemas and their access roles and that load the tables and rows, and each script runs once. This capability states how that set is resolved, created, seeded, reported and removed.

## Requirements

### Requirement: Multi list resolution

The system SHALL obtain the list of tenants from `db.multi.tenants` when that is set, and otherwise by running `db.multi.tenantsCmd` with `sh -c` in the project directory, with the process environment and after the replacement of `${worktree}`, `${slug}` and `${schema}`. It SHALL split the text on commas and whitespace, remove one pair of surrounding single or double quotes from each item, drop empty items and drop repeated items, keeping the first. Every value SHALL match `^[A-Za-z0-9_-]+$`. A command that exits non-zero, prints no value, or prints an invalid value SHALL fail the operation with an error that names the command and, as it applies, the status, the output or the value. The list SHALL be resolved at most once per operation, and only when a step expands `${multi.tenants}` or the builtin needs the tenant names. The builtin schema drop SHALL NOT run the command. A `deprovision` script whose env expands `${multi.tenants}` SHALL. A literal `tenants` SHALL NOT run a command.

#### Scenario: List picked out of a dotenv file

- **WHEN** `tenantsCmd` is `sed -rn ${worktree}/server/.env -e 's/^WITCHES=(.*)$/\1/p'` and that file holds the line `WITCHES=east,west,north`
- **THEN** the values are `east`, `west`, `north`, in that order

#### Scenario: Whitespace, quotes and repeats

- **WHEN** the command prints `"east", west` followed by a newline and `east`
- **THEN** the values are `east` and `west`

#### Scenario: Literal list runs no command

- **WHEN** `tenants` is `east,west` and `tenantsCmd` is absent
- **THEN** the values are `east` and `west` and no shell command runs

#### Scenario: The command names the file

- **WHEN** `tenantsCmd` contains `${worktree}` and the variant worktree is `/w/demo`
- **THEN** the command that runs contains `/w/demo`

#### Scenario: Command fails

- **WHEN** the command exits with status 2
- **THEN** the operation fails naming the command and status 2, and no schema is created

#### Scenario: No value

- **WHEN** the command prints nothing, or only separators
- **THEN** the operation fails naming the command and saying that it printed no value

#### Scenario: Invalid value

- **WHEN** the command prints `east,west;x`
- **THEN** the operation fails naming the command and the value `west;x`, and no schema is created

#### Scenario: Not needed to drop

- **WHEN** `deprovision` runs for a variant, no step is named `deprovision`, and the file that `tenantsCmd` reads no longer exists
- **THEN** the schemas of the variant are still dropped

### Requirement: Schemas of a variant

The system SHALL name the schema of a tenant by filling `${slug}` in `db.multi.schemaPrefix` and appending the tenant. A hyphen in the slug stays a hyphen. Where the builtin creates schemas, it SHALL create every such schema that does not exist and leave an existing one with its data. The `target` recorded in state and reported SHALL stay `v_<slug>` (a hyphen of the slug written as `_`). `main` SHALL never be created or dropped. `db.multi` with a dialect other than PostgreSQL SHALL fail when the client is created, naming the dialect.

#### Scenario: One schema per value

- **WHEN** the values are `east` and `west`, no step is named `provision`, and `provision` runs for `demo`
- **THEN** the schemas `v_demo-east` and `v_demo-west` exist and `target` is `v_demo`

#### Scenario: Existing schema kept

- **WHEN** `v_demo-east` holds a table, no step is named `provision`, and `watch` runs for `demo`
- **THEN** the table is still there, and `v_demo-west` is created when it was missing

#### Scenario: Custom prefix

- **WHEN** `schemaPrefix` is `v_${slug}_t_` and the value is `east`
- **THEN** the schema of `demo` is `v_demo_t_east`

#### Scenario: Another dialect

- **WHEN** `db.multi` is set and the dialect is `sqlite` or `mysql`
- **THEN** creating the client fails naming the dialect

### Requirement: Provision and seed run once

The system SHALL treat provisioning and seeding as scripts of the project, selected by step name, each run once. The script handles every value of the list. Provisioning is the creation of the schemas and of any extra role that uses them. Seeding is the creation of tables and the loading of rows. When `variant.steps` contains a step named `provision`, the builtin schema creation SHALL NOT run and that step SHALL run in its place, once. When no step is named `provision`, the builtin SHALL create the schema, or every schema of the list, and SHALL run no provision command. A step named `seed` SHALL run once, and there SHALL be no builtin seed. A custom step SHALL run once, after the step named by `runAfter` or before the step named by `runBefore`. The provision and seed scripts SHALL see the variant environment with `POSTGRES_SCHEMA` set to the variant target (`v_<slug>`), then the expanded `env` of the step. A step that sets `MULTI_TENANT_LIST: ${multi.tenants}` and `MULTI_SCHEMA_PREFIX: ${multi.schemaPrefix}` SHALL see the joined tenants and the expanded prefix. An alias of that `env` SHALL see the same values. A key the step sets itself SHALL win over a key of the same name from the variant environment. The phases of `watch` and of `up` SHALL run in this order: `create`, `provision`, the custom steps, `seed`, then the watches. The first failing command SHALL stop the pipeline and the error SHALL name the step. A step skipped by `VARIANT_STEP_<S>=no` SHALL not run, and a skipped `provision` step SHALL NOT fall back to the builtin. The command echo SHALL print `+ <command>` before every command.

#### Scenario: Builtin schemas when no provision step

- **WHEN** no step is named `provision`, the values are `east` and `west`, and `provision` runs for `demo`
- **THEN** the schemas `v_demo-east` and `v_demo-west` are created by the builtin and no provision command runs

#### Scenario: Provision script runs once

- **WHEN** a step named `provision` sets `MULTI_TENANT_LIST: ${multi.tenants}` and runs `sh -c 'echo "$MULTI_TENANT_LIST" >> out'`, and the values are `east` and `west`
- **THEN** the builtin creates no schema, and `out` has the single line `east,west`

#### Scenario: Seed script runs once

- **WHEN** the values are `east` and `west`, the `provision` step anchors its `env` with `MULTI_TENANT_LIST: ${multi.tenants}`, and a step named `seed` uses that alias and runs `sh -c 'echo "$MULTI_TENANT_LIST" >> out'`
- **THEN** `out` has the single line `east,west`

#### Scenario: The list reaches the script

- **WHEN** `schemaPrefix` is `v_${slug}-` and the `provision` step sets `MULTI_TENANT_LIST: ${multi.tenants}` and `MULTI_SCHEMA_PREFIX: ${multi.schemaPrefix}` for variant `demo` with values `east` and `west`
- **THEN** the step sees `MULTI_TENANT_LIST=east,west`, `MULTI_SCHEMA_PREFIX=v_demo-` and `POSTGRES_SCHEMA=v_demo`, and it runs once

#### Scenario: Step env wins

- **WHEN** the variant environment sets `MULTI_SCHEMA_PREFIX` and the `seed` step sets `MULTI_SCHEMA_PREFIX: fixed`
- **THEN** the step sees `MULTI_SCHEMA_PREFIX=fixed`

#### Scenario: Custom step after seed

- **WHEN** a step `migrations` sets `runAfter: seed` and the values are `east` and `west`
- **THEN** the `seed` step runs once and then `migrations` runs once

#### Scenario: Failure names the step

- **WHEN** the `provision` step exits with status 3
- **THEN** provisioning fails naming `provision` and status 3, and no later command runs

#### Scenario: Skipped provision

- **WHEN** the step named `provision` has `VARIANT_STEP_PROVISION` set to `no`
- **THEN** the script does not run, the builtin does not create a schema, and one line names the skipped step

#### Scenario: No builtin seed

- **WHEN** no step is named `seed` and `variant.seed` is unset
- **THEN** provisioning creates the schemas and runs no seed command

#### Scenario: Without db.multi

- **WHEN** `db.multi` is absent and a step is named `seed`
- **THEN** that step runs once and `${multi.tenants}` in its env is an empty string

### Requirement: Builtin flow

The system SHALL order the builtin steps `create`, `provision`, `seed`, `watch`, `down`, `deprovision`, `implode`. Running a step SHALL run the builtin steps above it first, except `down`, which SHALL only stop the watches. `deprovision` SHALL imply `down` and then run the deprovision phase. A `cmd` on the step named `deprovision` replaces the builtin drop. With no such command, the phase drops the database target. `implode` SHALL imply `deprovision` and then remove the worktree. `watch` SHALL imply `seed`. `seed` SHALL imply `provision`. `provision` SHALL imply `create`. `up` SHALL imply `seed` and then start containers. Slug `main` SHALL be refused by `deprovision` and by `implode`, and SHALL NOT be dropped by either.

#### Scenario: Watch implies the steps above it

- **WHEN** `watch` runs for `demo` and the worktree does not exist
- **THEN** the worktree is created, the provision phase runs, the seed phase runs, and then the watches start

#### Scenario: Down only stops watches

- **WHEN** `demo` has a running watch and a schema, and `down` runs
- **THEN** the watch is stopped and the schema still exists

#### Scenario: Deprovision implies down

- **WHEN** `demo` has a running watch, no step is named `deprovision`, and `deprovision` runs
- **THEN** the watch is stopped, the schema is dropped, and the worktree remains

#### Scenario: Implode implies deprovision

- **WHEN** `implode` runs for a merged variant `demo`
- **THEN** the schema is dropped and then the worktree is removed

#### Scenario: Main is kept

- **WHEN** `deprovision` runs for `main`
- **THEN** it fails and no schema is dropped

### Requirement: Reprovision

The system SHALL accept `--reprovision` on `watch`. When it is set, `watch` SHALL run `deprovision` before the provision phase, so the schemas are dropped and then created and seeded again. Without the flag, `watch` SHALL NOT drop a schema.

#### Scenario: Flag drops first

- **WHEN** `v_demo-east` holds a table and `watch --reprovision` runs for `demo` with no step named `provision` and the value `east`
- **THEN** the table is gone and `v_demo-east` is created empty before the watches start

#### Scenario: Without the flag

- **WHEN** the same table exists and `watch` runs without `--reprovision`
- **THEN** the table is still there when the watches start

### Requirement: Deprovision drops every schema of the variant

The system SHALL, when it deprovisions a variant that has `db.multi`, drop every schema whose name starts with the expanded `db.multi.schemaPrefix`, whether or not the tenant is in the current list. Literal characters, including `_`, SHALL match literally. A schema whose name does not start with that prefix SHALL stay. The builtin drop SHALL NOT drop a role. When the step named `deprovision` has a `cmd`, that script SHALL run once in place of the builtin drop, and it SHALL see the expanded env of the step. The script removes the schemas and anything else, such as a role, and it handles every tenant itself. The builtin drop SHALL NOT run after that script. When that step omits `cmd`, or no step is named `deprovision`, the builtin drop SHALL run and only the schemas are dropped. `VARIANT_STEP_DEPROVISION=no` SHALL skip the step and SHALL NOT fall back to the builtin drop. Deprovision SHALL NOT remove the worktree, the storage directory or the variant state.

#### Scenario: Value removed from the list

- **WHEN** `v_demo-east`, `v_demo-west` and `v_demo-north` exist, the list is now `east,west`, and `deprovision` runs for `demo`
- **THEN** all three schemas are dropped and the worktree remains

#### Scenario: Other slugs stay

- **WHEN** `v_demo-east`, `v_demo_two-east`, `v_demox-east` and `app-east` exist and `deprovision` runs for `demo`
- **THEN** only `v_demo-east` is dropped

#### Scenario: Underscore is literal

- **WHEN** `schemaPrefix` is `v_${slug}_x_`, `v_foo_x_east` and `v_fooxx_east` exist, and `deprovision` runs for `foo`
- **THEN** only `v_foo_x_east` is dropped

#### Scenario: Hyphen in the slug stays

- **WHEN** `schemaPrefix` is `v_${slug}-`, `v_foo-bar-east` and `v_foo_bar-east` exist, and `deprovision` runs for `foo-bar`
- **THEN** only `v_foo-bar-east` is dropped

#### Scenario: Roles stay

- **WHEN** no step is named `deprovision`, `v_demo-east` and a role `v_demo_east_app` exist, and `deprovision` runs for `demo`
- **THEN** the schema is dropped and the role remains

#### Scenario: Deprovision script replaces the drop

- **WHEN** a step named `deprovision` sets `MULTI_TENANT_LIST: ${multi.tenants}` and runs `sh -c 'echo "$MULTI_TENANT_LIST" >> out'`, the values are `east` and `west`, and `v_demo-east` exists
- **THEN** `out` has the single line `east,west` and `v_demo-east` still exists

#### Scenario: Skipped deprovision

- **WHEN** `VARIANT_STEP_DEPROVISION` is `no` and `v_demo` exists
- **THEN** `v_demo` still exists

### Requirement: One record per variant

The system SHALL report the schemas of a variant that has `db.multi` as one record, whatever their number. A schema whose name starts with that variant's expanded `schemaPrefix` SHALL be grouped under the variant the tool already knows from its worktree or its state, and the slug SHALL be that variant's slug. The reported `target` SHALL stay `v_<slug>` with a hyphen of the slug written as `_`. A record SHALL carry `schemas`, the sorted names of its schemas, when the variant has `db.multi`. Without `db.multi` a record SHALL have no `schemas` field.

#### Scenario: Three schemas, one record

- **WHEN** `v_demo-east`, `v_demo-west` and `v_demo-north` exist, the demo worktree exists, and no state file exists
- **THEN** `list` returns one record with slug `demo`, target `v_demo` and those three names in `schemas`

#### Scenario: Slug with a hyphen

- **WHEN** the `add-auth` worktree exists and `v_add-auth-east` exists
- **THEN** the record has slug `add-auth`, target `v_add_auth` and `schemas` holding `v_add-auth-east`

#### Scenario: Not a multi variant

- **WHEN** `db.multi` is absent
- **THEN** records have no `schemas` field

### Requirement: Lifecycle in the guide

The Overview page of the guide SHALL be linked above Core and SHALL document the builtin steps under the heading `Flow of Steps`, in the order `create`, `provision`, `seed`, `watch`, `down`, `deprovision`, `implode`. The text SHALL say that a later step implies the steps above it, that `down` only stops watches, that `deprovision` implies `down`, and that `implode` implies `deprovision`. It SHALL show `--reprovision` on `watch`. The deprovision section SHALL say that a step named `deprovision` replaces the builtin drop, and that with no such step the builtin drops the schema, or every schema under the prefix. A heading `Custom Steps` SHALL show a step `migrations` with `cmd`, `dir`, `env`, `filterLinesRegex` and `runAfter: seed`, and the page SHALL say that `runBefore` and `runAfter` name a builtin step or another custom step. A heading `Custom multi-tenancy steps` after that SHALL show the witches example from the design, including `schemaPrefix`, `tenantsCmd`, `provision`, `seed`, `migrations` and `deprovision`. The README SHALL NOT contain this section.

#### Scenario: Guide order

- **WHEN** `docs/guide/overview.md` is read
- **THEN** the heading `Flow of Steps` lists create, provision, seed, watch, down, deprovision and implode in that order, and the seed step says the project supplies the script

#### Scenario: Migrations example

- **WHEN** the heading `Custom Steps` is read
- **THEN** it shows `runAfter: seed` and says `runBefore` and `runAfter` name a builtin step or another step

#### Scenario: README stays free of the flow

- **WHEN** `README.md` is read
- **THEN** it has no heading `Flow of Steps`
