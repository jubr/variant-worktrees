## Purpose

Config file schema, connection autodetection (mise → env), validation, and `config` CLI command for variant-worktrees workspaces.

## ADDED Requirements

### Requirement: variants.yaml schema

The system SHALL validate `variants.yaml` against a JSON schema at parse time.

#### Scenario: Valid config file
- **WHEN** workspace has `variants.yaml` with `db.host`, `db.port`, `db.user`, `db.password`, `db.database` keys
- **THEN** parser returns typed config object

#### Scenario: Missing required field
- **WHEN** `variants.yaml` omits `db.host`
- **THEN** validation throws error with field name and location

#### Scenario: Invalid type
- **WHEN** `db.port` is string `"not-a-number"`
- **THEN** validation throws error with expected type

### Requirement: Connection config autodetection

The system SHALL detect connection config from mise env vars, then env vars, with explicit config override.

#### Scenario: Mise env detected
- **WHEN** mise.local.toml defines `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`
- **THEN** config builder loads those values into `db.*` fields

#### Scenario: Env var fallback
- **WHEN** mise.local.toml is absent and `process.env.POSTGRES_HOST` exists
- **THEN** config builder uses env vars

#### Scenario: Explicit override
- **WHEN** `variants.yaml` has `db.host = "custom.host"` and mise env has `POSTGRES_HOST = "auto.host"`
- **THEN** resulting config.db.host is `"custom.host"`

### Requirement: config CLI command

The system SHALL provide `variant config` command that prints detected config as JSON.

#### Scenario: Print detected config
- **WHEN** user runs `variant config`
- **THEN** stdout is JSON with `db`, `variants` sections

#### Scenario: Validation error reporting
- **WHEN** user runs `variant config` and `variants.yaml` is invalid
- **THEN** stderr shows validation error, exit code 1

### Requirement: Seed command configuration

The system SHALL allow `variants.yaml` to define a `seed` command per variant or globally.

#### Scenario: Global seed command
- **WHEN** `variants.yaml` has `seed: "bun run db:seed"`
- **THEN** `variant provision` executes that command with variant env

#### Scenario: Per-variant seed override
- **WHEN** config has `variants.main.seed = "echo skip"` and global `seed = "bun run db:seed"`
- **THEN** provisioning slug `main` runs `echo skip`
