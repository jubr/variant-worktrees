## MODIFIED Requirements

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
