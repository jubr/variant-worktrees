# variant-config/cfg-multi-schema Specification

## Purpose

Configuration of a variant that owns several database schemas, one per tenant: the `db.multi` settings and the placeholders a step passes to its script.

## Requirements

### Requirement: Multi-schema settings

The system SHALL accept an optional `db.multi`. It SHALL require exactly one of `tenants` (a non-empty list written as text) and `tenantsCmd` (a non-empty shell command). `schemaPrefix` SHALL default to `v_${slug}-` and SHALL otherwise be whatever non-empty template the project writes. The loader SHALL NOT require it to start with `v_`, to contain `${slug}`, or to end with `-` or `_`. `db.multi` SHALL NOT be part of the database settings recorded in `.cache/variant/runtime.yaml`. The loader SHALL resolve YAML anchors, so a step `env` that is an alias sees the anchored map.

#### Scenario: Defaults

- **WHEN** `db.multi` holds only `tenantsCmd: echo east,west`
- **THEN** loading succeeds and `schemaPrefix` is `v_${slug}-`

#### Scenario: Literal list

- **WHEN** `db.multi` holds `tenants: east,west` and no `tenantsCmd`
- **THEN** loading succeeds

#### Scenario: Both list forms

- **WHEN** `db.multi` holds both `tenants` and `tenantsCmd`
- **THEN** loading the configuration fails validation naming `db.multi`

#### Scenario: Neither list form

- **WHEN** `db.multi` has no `tenants` and no `tenantsCmd`, or an empty one
- **THEN** loading the configuration fails validation naming `db.multi.tenants`

#### Scenario: Prefix is not shaped

- **WHEN** `db.multi.schemaPrefix` is `app_${slug}`, `v_${slug}` or `v_app-`
- **THEN** loading succeeds

#### Scenario: Shared env anchor

- **WHEN** a step `provision` sets `env: &prov-env` with `MULTI_TENANT_LIST: ${multi.tenants}` and a step `seed` sets `env: *prov-env`
- **THEN** both steps have the same `MULTI_TENANT_LIST` value

#### Scenario: Not in the runtime state

- **WHEN** a variant with `db.multi` is provisioned
- **THEN** the database settings in its `.cache/variant/runtime.yaml` hold no `multi`

### Requirement: Multi placeholders

The system SHALL replace `${multi.tenants}` with the tenant values joined by commas, and `${multi.schemaPrefix}` with `schemaPrefix` after `${slug}` is filled in, in the `env` of a step, in the same pass as the other variant placeholders. `${multi.tenants}` SHALL be resolved the first time that operation expands it or the builtin needs the tenant names, and then reused. `${multi.schemaPrefix}` SHALL NOT run `tenantsCmd`. When `db.multi` is absent both placeholders SHALL render as an empty string. In `tenantsCmd` the system SHALL replace `${worktree}`, `${slug}` and `${schema}` before the command runs, and then `${NAME}` and `${NAME:-default}` from the environment as everywhere else.

#### Scenario: Prefix placeholder

- **WHEN** a step env has `MULTI_SCHEMA_PREFIX: ${multi.schemaPrefix}`, `schemaPrefix` is `v_${slug}-` and the slug is `demo`
- **THEN** the expanded value is `v_demo-` and `tenantsCmd` has not run

#### Scenario: List placeholder

- **WHEN** a step env has `MULTI_TENANT_LIST: ${multi.tenants}` and the values are `east` and `west`
- **THEN** the expanded value is `east,west`

#### Scenario: Empty without db.multi

- **WHEN** `db.multi` is absent and a step env value is `${multi.tenants}`
- **THEN** the expanded value is an empty string

#### Scenario: Worktree in the command

- **WHEN** `tenantsCmd` is `cat ${worktree}/server/.env` and the worktree is `/w/demo`
- **THEN** the command that runs is `cat /w/demo/server/.env`
