## ADDED Requirements

### Requirement: Provisioning steps
The system SHALL accept an optional list `variant.steps`. Each step has a required `name` and `run` (shell commands), and optional `dir` (a path relative to the worktree, default the worktree root, never absolute or climbing out of it), `env` (a map of templated values), `unlessEnv` (a map of environment variable names to values) and `show` (a regular expression). Step names SHALL be unique within the list. Unknown keys SHALL fail validation.

#### Scenario: Valid steps

- **WHEN** `variant.steps` holds `{ name: migrations, run: "bun run migrate", dir: server, show: "^Migration " }`
- **THEN** loading succeeds and the step is carried unchanged

#### Scenario: Duplicate names

- **WHEN** two steps are named `migrations`
- **THEN** loading the configuration fails validation naming the duplicate

#### Scenario: Invalid pattern

- **WHEN** a step `show` is not a valid regular expression
- **THEN** loading the configuration fails validation

### Requirement: Command templates
The system SHALL expand templates in the string values of the `env` of every entry of `variant.steps`, the `env`, `envAlways` and `container.env` of every entry of `variant.instances`, and the `container.volumes` of every entry of `variant.instances`. The variant placeholders SHALL be replaced first: `{{slug}}`, `{{schema}}` (the database target of the variant), `{{storage}}` (the absolute storage directory), `{{worktree}}` (the absolute worktree path), `{{url}}` (the rendered `open` URL of the instance, empty when it has none), `{{port}}` (the port of the instance the value belongs to; empty for a step) and `{{port.<name>}}` (the port of another instance, by its key). Then `{{NAME}}` SHALL be replaced by the process environment variable `NAME`, and `{{NAME:-default}}` by that variable or, when it is unset or empty, by `default`. A `{{NAME}}` whose variable is unset SHALL fail with an error that names the variable.

#### Scenario: Variant placeholders

- **WHEN** an instance `env` value is `{{slug}}-{{port}}` for slug `demo` and port 62060
- **THEN** the expanded value is `demo-62060`

#### Scenario: Port of another instance

- **WHEN** the instance `fe` has the value `{{port.be}}` and the instance `be` has port 62061
- **THEN** the expanded value is `62061`

#### Scenario: Environment default

- **WHEN** a value is `{{JWT_SECRET:-local-{{slug}}}}`, the slug is `demo`, and `JWT_SECRET` is unset
- **THEN** the expanded value is `local-demo`

#### Scenario: Environment value wins over default

- **WHEN** a value is `{{JWT_SECRET:-local}}` and `JWT_SECRET` is `s3cret`
- **THEN** the expanded value is `s3cret`

#### Scenario: Unset variable without default

- **WHEN** a value is `{{MISSING_VAR}}` and `MISSING_VAR` is unset
- **THEN** expansion fails with an error that names `MISSING_VAR`
