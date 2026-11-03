## Purpose

Configuration of a variant that owns several database schemas, one per value of a list that a command prints: the `db.multi` settings and the placeholders that name the current value.

## ADDED Requirements

### Requirement: Multi-schema settings

The system SHALL accept an optional `db.multi` with a required `schemasCmd` (a non-empty shell command) and the optional `schemaPattern`, `env` and `roleSuffix`. `schemaPattern` SHALL default to `{{schema}}-{{multi}}`. A pattern SHALL start with `{{schema}}`, hold `{{multi}}` exactly once, and otherwise hold only letters, digits, `_` and `-`, so that every name it produces is a plain quoted identifier that starts with the variant's own target. `env` SHALL be a map of environment variable names to templated values. `roleSuffix` SHALL hold only lowercase letters, digits and `_`. `db.multi` SHALL NOT be part of the database settings recorded in the runtime state of a variant.

#### Scenario: Defaults

- **WHEN** `db.multi` holds only `schemasCmd: echo east,west`
- **THEN** loading succeeds and the resolved pattern is `{{schema}}-{{multi}}`

#### Scenario: Missing command

- **WHEN** `db.multi` has no `schemasCmd` or an empty one
- **THEN** loading the configuration fails validation naming `db.multi.schemasCmd`

#### Scenario: Pattern without the value

- **WHEN** `db.multi.schemaPattern` is `{{schema}}-all`
- **THEN** loading the configuration fails validation naming `db.multi.schemaPattern`

#### Scenario: Pattern that does not start with the target

- **WHEN** `db.multi.schemaPattern` is `{{multi}}-{{schema}}` or `tenant-{{multi}}`
- **THEN** loading the configuration fails validation naming `db.multi.schemaPattern`

#### Scenario: Pattern with unsafe characters

- **WHEN** `db.multi.schemaPattern` is `{{schema}}-{{multi}}"; drop`
- **THEN** loading the configuration fails validation naming `db.multi.schemaPattern`

#### Scenario: Role suffix

- **WHEN** `db.multi.roleSuffix` is `_app`
- **THEN** loading succeeds, and `App` or `_a-b` fail validation

#### Scenario: Not in the runtime state

- **WHEN** a variant with `db.multi` is provisioned
- **THEN** the `runtime.db` section of its `variants.local.yaml` holds no `multi`

### Requirement: Multi placeholders

The system SHALL replace `{{multi}}` (one value of the list) and `{{multiSchema}}` (the schema name of that value) in the values of `db.multi.env` and in the `env` of a step named `provision` or `seed`, in the same pass as the other variant placeholders. Outside such a run both SHALL render as an empty string. In `schemasCmd` the system SHALL replace `{{dir}}` with the absolute project directory of the primary checkout, and then `{{NAME}}` and `{{NAME:-default}}` from the environment as everywhere else.

#### Scenario: Value placeholders

- **WHEN** `db.multi.env` has `TENANT: '{{multi}}'` and `SCHEMA: '{{multiSchema}}'`, the variant target is `v_demo` and the value is `west`
- **THEN** the expanded values are `west` and `v_demo-west`

#### Scenario: Empty outside a per-value run

- **WHEN** a watch `env.overrides` value is `{{multi}}`
- **THEN** the expanded value is an empty string

#### Scenario: Directory in the command

- **WHEN** `schemasCmd` is `cat {{dir}}/tenants.txt` and the primary project directory is `/p`
- **THEN** the command that runs is `cat /p/tenants.txt`
