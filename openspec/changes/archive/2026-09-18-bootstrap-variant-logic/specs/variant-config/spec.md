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

### Requirement: Runtime instance discovery

The system SHALL use explicitly configured runtime instances when present and otherwise discover Vite or NestJS instances by searching subdirectories from the directory containing `variants.yaml`.

#### Scenario: Explicit instances take precedence
- **WHEN** `variants.yaml` defines `variant.instances`
- **THEN** runtime commands use those instances without filesystem autodetection

#### Scenario: Vite instance autodetected
- **WHEN** `variant.instances` is absent and a searched subdirectory contains Vite configuration
- **THEN** the config includes that subdirectory as a Vite instance

#### Scenario: NestJS instance autodetected
- **WHEN** `variant.instances` is absent and a searched subdirectory contains NestJS configuration
- **THEN** the config includes that subdirectory as a NestJS instance

### Requirement: Variant worktree root resolution

The system SHALL resolve the base directory for `_v-<slug>` worktrees from
explicit `variant.root` configuration or workspace/git metadata.

#### Scenario: Explicit variant root
- **WHEN** `variants.yaml` defines `variant.root`
- **THEN** the configured path, resolved relative to `variants.yaml`, is used as the worktree base

#### Scenario: Parent AGENTS symlink
- **WHEN** the parent directory of `variants.yaml` contains an `AGENTS.md` symlink targeting the main git directory
- **THEN** the symlink target's directory is used as the worktree base

#### Scenario: Git carrying directory fallback
- **WHEN** `variant.root` is absent and no parent `AGENTS.md` symlink exists
- **THEN** the git common/carrying directory containing the real `AGENTS.md` is used as the worktree base
