# variant-config/cfg-provisioning Specification

## Purpose
Provisioning configuration in `variants.yaml` holds the ordered steps that run before the seed command and the template syntax that fills variant, port and environment values into commands and environments.

## Requirements

### Requirement: Provisioning steps
The system SHALL accept an optional list `variant.steps`. Each step has a required `name` and `run` (shell commands), and optional `dir` (a path relative to the worktree, default the worktree root, never absolute or climbing out of it), `env` (a map of templated values) and `filterLinesRegex` (a regular expression). A step name SHALL hold only letters, digits, `-` and `_`. Step names SHALL be unique within the list, and two names that map to the same environment variable segment (letters uppercased, every other character replaced by `_`) SHALL fail validation. Unknown keys, including the former `show` and `unlessEnv`, SHALL fail validation.

#### Scenario: Valid steps

- **WHEN** `variant.steps` holds `{ name: migrations, run: "bun run migrate", dir: server, filterLinesRegex: "^Migration " }`
- **THEN** loading succeeds and the step is carried unchanged

#### Scenario: Duplicate names

- **WHEN** two steps are named `migrations`
- **THEN** loading the configuration fails validation naming the duplicate

#### Scenario: Colliding segments

- **WHEN** two steps are named `db-seed` and `db_seed`
- **THEN** loading the configuration fails validation naming both

#### Scenario: Name with other characters

- **WHEN** a step is named `run migrations` or `a.b`
- **THEN** loading the configuration fails validation

#### Scenario: Invalid pattern

- **WHEN** a step `filterLinesRegex` is not a valid regular expression
- **THEN** loading the configuration fails validation

#### Scenario: Former keys refused

- **WHEN** a step sets `show` or `unlessEnv`
- **THEN** loading the configuration fails validation

### Requirement: Command templates
The system SHALL expand templates in the string values of the `env` of every entry of `variant.steps` and the `env.overrides` of every entry of `variant.instances`. The variant placeholders SHALL be replaced first: `{{slug}}`, `{{schema}}` (the database target of the variant), `{{storage}}` (the absolute storage directory), `{{worktree}}` (the absolute worktree path), `{{url}}` (the rendered `url` of the instance, empty when it has none), `{{port}}` (the port of the instance the value belongs to; empty for a step) and `{{<key>.port}}` (the port of another instance, by its key). The former `{{port.<key>}}` SHALL fail with an error that names `{{<key>.port}}`. Then `{{NAME}}` SHALL be replaced by the process environment variable `NAME`, and `{{NAME:-default}}` by that variable or, when it is unset or empty, by `default`. A `{{NAME}}` whose variable is unset SHALL fail with an error that names the variable.

#### Scenario: Variant placeholders

- **WHEN** an instance `env.overrides` value is `{{slug}}-{{port}}` for slug `demo` and port 62060
- **THEN** the expanded value is `demo-62060`

#### Scenario: Port of another instance

- **WHEN** the instance `fe` has the value `{{be.port}}` and the instance `be` has port 62061
- **THEN** the expanded value is `62061`

#### Scenario: Port of an unknown instance

- **WHEN** a value is `{{missing.port}}` and no instance has the key `missing`
- **THEN** expansion fails with an error that names `missing`

#### Scenario: Former port placeholder

- **WHEN** a value is `{{port.be}}`
- **THEN** expansion fails with an error that names `{{be.port}}`

#### Scenario: Environment default

- **WHEN** a value is `{{JWT_SECRET:-local-{{slug}}}}`, the slug is `demo`, and `JWT_SECRET` is unset
- **THEN** the expanded value is `local-demo`

#### Scenario: Environment value wins over default

- **WHEN** a value is `{{JWT_SECRET:-local}}` and `JWT_SECRET` is `s3cret`
- **THEN** the expanded value is `s3cret`

#### Scenario: Unset variable without default

- **WHEN** a value is `{{MISSING_VAR}}` and `MISSING_VAR` is unset
- **THEN** expansion fails with an error that names `MISSING_VAR`
