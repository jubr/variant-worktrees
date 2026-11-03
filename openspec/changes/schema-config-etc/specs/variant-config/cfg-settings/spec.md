## MODIFIED Requirements

### Requirement: Variant storage
The system SHALL accept an optional `variant.storage` with `dir`, a path relative to the worktree defaulting to `.storage`, and `envVarName`, the name of an environment variable that carries the absolute storage directory to commands and is written into the env file copy of every watch that has an `env.sourceFile`, defaulting to `STORAGE_ROOT`. When `variant.storage` is absent a variant has no storage directory, `{{storage}}` is empty, and no storage environment variable is set. A `dir` that is absolute or climbs out of the worktree SHALL fail validation. The former key `env` SHALL be ignored with a warning.

#### Scenario: Defaults

- **WHEN** `variant.storage` is `{}`
- **THEN** the resolved directory is `.storage` and the variable is `STORAGE_ROOT`

#### Scenario: Custom variable name

- **WHEN** `variant.storage.envVarName` is `APP_DATA`
- **THEN** the resolved variable is `APP_DATA`

#### Scenario: Former key refused

- **WHEN** `variant.storage.env` is `APP_DATA`
- **THEN** loading succeeds, the key is ignored and one warning names it; the variable stays `STORAGE_ROOT`

#### Scenario: Escaping directory

- **WHEN** `variant.storage.dir` is `../shared`
- **THEN** loading the configuration fails validation

#### Scenario: No storage

- **WHEN** `variant.storage` is absent
- **THEN** the resolved configuration has no storage settings

### Requirement: Supervision settings
The system SHALL accept an optional `variant.supervise` with `startDelaySeconds` (default 2), `readyTimeoutSeconds` (default 180) and `checkoutPollSeconds` (default 5). The delay SHALL be the wait between starting one watch and the next. `readyTimeoutSeconds` SHALL be the wait for the watches that set `ready`. A `checkoutPollSeconds` of 0 SHALL disable the checkout check. Negative numbers SHALL fail validation.

#### Scenario: Defaults

- **WHEN** `variant.supervise` is absent
- **THEN** the resolved values are 2, 180 and 5

#### Scenario: Negative value

- **WHEN** `variant.supervise.startDelaySeconds` is `-1`
- **THEN** loading the configuration fails validation

### Requirement: UI server settings

The system SHALL accept an optional `variant.ui` object that holds the settings of the `variant ui` server, with the optional `port`, a TCP port the server listens on. The environment variable `VARIANT_UI_PORT` is the override of `variant.ui.port` (see `variant-server/ui-instance`). Unknown keys below `variant.ui` SHALL be ignored with a warning, and a port that is not a positive integer SHALL fail validation.

#### Scenario: Port set

- **WHEN** `variants.yaml` sets `variant.ui.port: 62100`
- **THEN** the resolved configuration carries `variant.ui.port` 62100

#### Scenario: Absent

- **WHEN** `variant.ui` is absent
- **THEN** loading succeeds and the resolved configuration has no `variant.ui.port`

#### Scenario: Invalid port

- **WHEN** `variant.ui.port` is `0`, `"abc"` or `1.5`
- **THEN** loading the configuration fails validation

#### Scenario: Unknown key

- **WHEN** `variants.yaml` sets `variant.ui.color: red`
- **THEN** loading succeeds, the key is ignored and one warning names it

### Requirement: Implode settings
The system SHALL accept an optional `variant.implode` with `preRm` (a list of glob patterns of paths to remove, which may hold `{{slug}}`), `discard` (a list of file names), `requireMerged` (boolean, default `true`) and `maxDiffLines` (non-negative integer, default 200). A `preRm` entry SHALL NOT be absolute or contain a `..` segment. A `discard` entry SHALL NOT contain a path separator or climb out of a directory. `preRm` and `discard` SHALL default to empty lists. The former keys `untracked` and `restore` SHALL be ignored with a warning. The resolved configuration SHALL always carry `requireMerged` and `maxDiffLines`.

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
- **THEN** loading succeeds, neither key takes effect and one warning names each
