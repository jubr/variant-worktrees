## MODIFIED Requirements

### Requirement: Variant storage
The system SHALL accept an optional `variant.storage` with `dir`, a path relative to the worktree defaulting to `.storage`, and `envVarName`, the name of an environment variable that carries the absolute storage directory to commands and is written into the env file copy of every instance that has an `env.sourceFile`, defaulting to `STORAGE_ROOT`. When `variant.storage` is absent a variant has no storage directory, `{{storage}}` is empty, and no storage environment variable is set. A `dir` that is absolute or climbs out of the worktree SHALL fail validation. The former key `env` SHALL fail validation.

#### Scenario: Defaults

- **WHEN** `variant.storage` is `{}`
- **THEN** the resolved directory is `.storage` and the variable is `STORAGE_ROOT`

#### Scenario: Custom variable name

- **WHEN** `variant.storage.envVarName` is `APP_DATA`
- **THEN** the resolved variable is `APP_DATA`

#### Scenario: Former key refused

- **WHEN** `variant.storage.env` is `APP_DATA`
- **THEN** loading the configuration fails validation

#### Scenario: Escaping directory

- **WHEN** `variant.storage.dir` is `../shared`
- **THEN** loading the configuration fails validation

#### Scenario: No storage

- **WHEN** `variant.storage` is absent
- **THEN** the resolved configuration has no storage settings

### Requirement: Implode settings
The system SHALL accept an optional `variant.implode` with `preRm` (a list of glob patterns of paths to remove, which may hold `{{slug}}`), `discard` (a list of file names), `requireMerged` (boolean, default `true`) and `maxDiffLines` (non-negative integer, default 200). A `preRm` entry SHALL NOT be absolute or contain a `..` segment. A `discard` entry SHALL NOT contain a path separator or climb out of a directory. `preRm` and `discard` SHALL default to empty lists. The former keys `untracked` and `restore` SHALL fail validation. The resolved configuration SHALL always carry `requireMerged` and `maxDiffLines`.

#### Scenario: Example settings

- **WHEN** `variant.implode.preRm` is `[dist, node_modules, "openspec/changes/{{slug}}/pr*-demo.webm"]` and `discard` is `[package-lock.json, bun.lock]`
- **THEN** loading succeeds and the resolved lists equal those values

#### Scenario: Defaults

- **WHEN** `variant.implode` is absent
- **THEN** the resolved lists are empty, `requireMerged` is `true` and `maxDiffLines` is 200

#### Scenario: Escaping pattern

- **WHEN** a `preRm` entry is `../outside` or `/tmp/x`
- **THEN** loading the configuration fails validation

#### Scenario: Path in a name

- **WHEN** a `discard` entry is `a/b` or `..`
- **THEN** loading the configuration fails validation

#### Scenario: Former keys refused

- **WHEN** `variant.implode` sets `untracked` or `restore`
- **THEN** loading the configuration fails validation
