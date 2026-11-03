## Purpose

A variant can own one PostgreSQL schema per tenant. The project supplies the scripts that create a schema and its access role and that load its tables and rows. This capability states how that set is resolved, created, seeded, reported and removed, and what differs from a one-schema variant when `db.multi` is set.

## ADDED Requirements

### Requirement: Multi list resolution

The system SHALL obtain the list of values by running `db.multi.schemasCmd` with `sh -c` in the project directory of the primary checkout, with the process environment and after the replacement of `{{dir}}`. It SHALL split the standard output on commas and whitespace, remove one pair of surrounding single or double quotes from each item, drop empty items and drop repeated items, keeping the first. Every value SHALL match `^[A-Za-z0-9_-]+$`. A command that exits non-zero, prints no value, or prints an invalid value SHALL fail the operation with an error that names the command and, as it applies, the status, the output or the value. The list SHALL be resolved at most once per operation, and only by an operation that creates or seeds (`create`, `up`, `watch`, `provision`).

#### Scenario: List picked out of a dotenv file

- **WHEN** `schemasCmd` is `sed -nr 's/^TENANT_LIST=(.*)$/\1/p' {{dir}}/server/.env` and that file holds the line `TENANT_LIST=east,west,north`
- **THEN** the values are `east`, `west`, `north`, in that order

#### Scenario: Whitespace, quotes and repeats

- **WHEN** the command prints `"east", west` followed by a newline and `east`
- **THEN** the values are `east` and `west`

#### Scenario: Primary checkout is the source

- **WHEN** the variant `demo` has its own worktree and the file read by `schemasCmd` exists in both checkouts with different lists
- **THEN** the list of the primary checkout is used

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

- **WHEN** `down` runs for a variant and the file that `schemasCmd` reads no longer exists
- **THEN** the schemas of the variant are still dropped

### Requirement: Schemas of a variant

The system SHALL name the schema of a value by replacing `{{schema}}` in `db.multi.schemaPattern` with the target of the variant (`v_<slug>`, a hyphen of the slug written as `_`; for `main`, `db.schema` or `public`) and `{{multi}}` with the value. Where the builtin creates schemas, it SHALL create every such schema that does not exist and leave an existing one with its data, and `up` SHALL drop every schema of the variant before it creates them. The `target` recorded in state and reported SHALL stay `v_<slug>`. `main` SHALL never be created, dropped or recreated. `db.multi` with a dialect other than PostgreSQL SHALL fail when the client is created, naming the dialect.

#### Scenario: One schema per value

- **WHEN** the values are `east` and `west`, no step is named `provision`, and `create("demo")` runs
- **THEN** the schemas `v_demo-east` and `v_demo-west` exist and `target` is `v_demo`

#### Scenario: Existing schema kept

- **WHEN** `v_demo-east` holds a table, no step is named `provision`, and `watch` runs for `demo`
- **THEN** the table is still there, and `v_demo-west` is created when it was missing

#### Scenario: Clean up

- **WHEN** `v_demo-north` exists but is no longer in the list and `up` runs for `demo` with the values `east` and `west` and no step named `provision`
- **THEN** `v_demo-north` is gone and `v_demo-east` and `v_demo-west` are empty

#### Scenario: Custom pattern

- **WHEN** `schemaPattern` is `{{schema}}_t_{{multi}}` and the value is `east`
- **THEN** the schema of `demo` is `v_demo_t_east`

#### Scenario: Another dialect

- **WHEN** `db.multi` is set and the dialect is `sqlite` or `mysql`
- **THEN** creating the client fails naming the dialect

### Requirement: Provision and seed are project scripts

The system SHALL treat provisioning and seeding as scripts of the project, selected by step name. Provisioning is the creation of the schema and of any extra role that uses it. Seeding is the creation of tables and the loading of rows. When `variant.steps` contains a step named `provision`, the builtin schema creation SHALL NOT run and that step SHALL run in its place, once per value when `db.multi` is set and once otherwise. When no step is named `provision`, the builtin SHALL create the schema, or one schema per value, before the first step. A step named `seed` SHALL run once per value when `db.multi` is set and once otherwise, and there SHALL be no builtin seed. Every other step SHALL run once. A per-value run SHALL see the variant environment with `POSTGRES_SCHEMA` set to the schema of that value, `VARIANT_MULTI` set to the value and `VARIANT_MULTI_SCHEMA` set to that schema name, then the expanded `db.multi.env`, then the expanded `env` of the step, which wins. `VARIANT_TARGET` SHALL stay the target of the variant. The phases SHALL run in this order: the worktree, the provision phase, the other steps in listed order, the seed phase, and then the `variant.seed` command once when it is set. The first failing run SHALL stop the pipeline and the error SHALL name the value together with the step. A step skipped by `VARIANT_STEP_<S>=no` SHALL skip every run of it. The command echo SHALL print `+ <command>` before every run. `watch` and `up` SHALL run the worktree, provision and seed phases before starting anything.

#### Scenario: Builtin schema when no provision step

- **WHEN** no step is named `provision`, the values are `east` and `west`, and the variant is provisioned
- **THEN** the schemas `v_demo-east` and `v_demo-west` are created by the builtin and no provision command runs

#### Scenario: Provision script instead of the builtin

- **WHEN** a step named `provision` runs `sh -c 'echo $VARIANT_MULTI >> out'` and the values are `east` and `west`
- **THEN** the builtin creates no schema, and `out` has the lines `east` and `west`

#### Scenario: Seed script for every value

- **WHEN** the values are `east` and `west` and a step named `seed` runs `sh -c 'echo $VARIANT_MULTI >> out'`
- **THEN** `out` has the lines `east` and `west`, in that order

#### Scenario: Another step runs once

- **WHEN** a step named `report` runs `sh -c 'echo once >> out'` and the values are `east` and `west`
- **THEN** `out` has the line `once` once

#### Scenario: Value in the schema variable

- **WHEN** the variant is `demo` and the `seed` step runs for `west`
- **THEN** the step sees `POSTGRES_SCHEMA=v_demo-west`, `VARIANT_MULTI=west`, `VARIANT_MULTI_SCHEMA=v_demo-west` and `VARIANT_TARGET=v_demo`

#### Scenario: Configured environment

- **WHEN** `db.multi.env` is `{ TENANT: '{{multi}}', SCHEMA_PREFIX: '{{schema}}-' }` and the `seed` step runs for `west` of variant `demo`
- **THEN** the step sees `TENANT=west` and `SCHEMA_PREFIX=v_demo-`

#### Scenario: Step env wins

- **WHEN** the `seed` step sets `env: { TENANT: fixed }` and `db.multi.env` sets `TENANT: '{{multi}}'`
- **THEN** the step sees `TENANT=fixed`

#### Scenario: Phase order

- **WHEN** the steps are listed as `seed`, `report`, `provision` and the values are `east` and `west`
- **THEN** the commands run as `provision` for `east`, `provision` for `west`, `report` once, `seed` for `east`, `seed` for `west`

#### Scenario: Failure names the value

- **WHEN** the `provision` step exits with status 3 for `west`
- **THEN** provisioning fails naming `west`, `provision` and status 3, and no later command runs

#### Scenario: Skipped step

- **WHEN** the step named `provision` has `VARIANT_STEP_PROVISION` set to `no`
- **THEN** no run of it happens, the builtin does not create a schema either, and one line names the skipped step

#### Scenario: No builtin seed

- **WHEN** no step is named `seed` and `variant.seed` is unset
- **THEN** provisioning creates the schemas and runs no seed command

#### Scenario: Without db.multi

- **WHEN** `db.multi` is absent and a step is named `seed`
- **THEN** that step runs once and sees no `VARIANT_MULTI`

### Requirement: Deprovision drops every schema of the variant

The system SHALL, when it deprovisions a variant that has `db.multi` (`down`, `implode`, and the removal of a vanished checkout by an attached `watch`), drop every schema whose name matches `db.multi.schemaPattern` with `{{schema}}` replaced by the target of the slug and `{{multi}}` replaced by any text, whether or not the value is in the current list. Literal characters, including `_`, SHALL match literally. A schema of another slug SHALL stay, including one whose slug merely begins with the same characters. The system SHALL NOT drop a schema when the slug is `main`. When `db.multi.roleSuffix` is set, it SHALL also drop, for every schema it dropped, the role named by the schema with every `-` written as `_` followed by the suffix, if that role exists, together with what it owns. Deprovision SHALL NOT remove the worktree, the storage directory or the variant state; `implode` continues with those after it.

#### Scenario: Value removed from the list

- **WHEN** `v_demo-east`, `v_demo-west` and `v_demo-north` exist, the list is now `east,west`, and `down` runs for `demo`
- **THEN** all three schemas are dropped and the worktree remains

#### Scenario: Other slugs stay

- **WHEN** `v_demo-east`, `v_demo_two-east`, `v_demox-east` and `app-east` exist and `down` runs for `demo`
- **THEN** only `v_demo-east` is dropped

#### Scenario: Underscore is literal

- **WHEN** `v_foo_bar-east` and `v_fooxbar-east` exist and `down` runs for `foo-bar`
- **THEN** only `v_foo_bar-east` is dropped

#### Scenario: Main protected

- **WHEN** `down` runs for `main`
- **THEN** it stops the runtime as before and no schema is dropped

#### Scenario: Roles follow their schemas

- **WHEN** `roleSuffix` is `_app`, `v_demo-east` and the role `v_demo_east_app` exist, and `implode` runs for `demo`
- **THEN** the schema and the role are dropped

#### Scenario: No role suffix

- **WHEN** `roleSuffix` is not set and a role `v_demo_east_app` exists
- **THEN** the role is left alone

### Requirement: One record per variant

The system SHALL report the schemas of a variant that has `db.multi` as one record, whatever their number: every schema whose name matches `db.multi.schemaPattern` with `{{schema}}` captured as the target and `{{multi}}` as any text SHALL be grouped under that target, and the slug SHALL be derived from the target as for a one-schema variant. A record SHALL carry `schemas`, the sorted names of its schemas, when the variant has `db.multi`. Without `db.multi` a record SHALL have no `schemas` field.

#### Scenario: Three schemas, one record

- **WHEN** `v_demo-east`, `v_demo-west` and `v_demo-north` exist and no state file exists
- **THEN** `list` returns one record with slug `demo`, target `v_demo` and those three names in `schemas`

#### Scenario: Slug with a hyphen

- **WHEN** `v_add_auth-east` exists
- **THEN** the record has slug `add-auth`

#### Scenario: Not a multi variant

- **WHEN** `db.multi` is absent
- **THEN** records have no `schemas` field

### Requirement: Lifecycle in the guide

The guide SHALL document the lifecycle of a variant as six phases, in this order, and the README SHALL NOT contain this section. Each phase SHALL name who performs it.

1. `create`, builtin: the git worktree.
2. `provision`, builtin: the naive schema creation, or the project's step named `provision` when that step exists. The step creates the schema and any extra role that uses it.
3. `seed`, builtin phase, always a script: the project's step named `seed`, which creates the tables and loads the rows. The text SHALL say there is no builtin seed.
4. `watch`, builtin: runs the three phases above, then the watch processes.
5. `down`, builtin: stops the runtime and deprovisions `v_<slug>`, or every schema matching `v_<slug>-*` when `db.multi` is set.
6. `implode`, builtin: deprovision, then removal of the worktree.

The configuration page SHALL show `db.multi` with a `schemasCmd` that reads `TENANT_LIST` from a dotenv file, a step named `provision` and a step named `seed`.

#### Scenario: Guide order

- **WHEN** the lifecycle section of `docs/guide/core.md` is read
- **THEN** the six phases appear in the order create, provision, seed, watch, down, implode, and the seed phase says the project supplies the script

#### Scenario: README stays free of the lifecycle

- **WHEN** `README.md` is read
- **THEN** it has no heading for this lifecycle and no list of the six phases

#### Scenario: Configuration example

- **WHEN** the `db.multi` example in `docs/guide/configuration.md` is read
- **THEN** it contains `schemasCmd`, a step named `provision` and a step named `seed`
