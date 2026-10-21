## ADDED Requirements

### Requirement: Branch naming settings
The system SHALL accept an optional `variant.baseBranch`, a non-empty string naming the branch that new variant branches start from and that a variant must be merged into before it is imploded, defaulting to `main`. The system SHALL accept an optional `variant.branchPrefixes`, a non-empty list of strings that each end in `/`, defaulting to `["feat/", "fix/"]`. The first entry SHALL prefix the branch of a new variant worktree. Every entry, and `feature/`, SHALL be removed from a branch name when a slug is derived from it. The resolved configuration SHALL always carry both settings.

#### Scenario: Defaults

- **WHEN** `variants.yaml` defines neither option
- **THEN** the resolved base branch is `main` and the resolved prefixes are `feat/` and `fix/`

#### Scenario: Custom values

- **WHEN** `variant.baseBranch` is `develop` and `variant.branchPrefixes` is `["task/"]`
- **THEN** the resolved configuration carries exactly those values

#### Scenario: Invalid prefix

- **WHEN** an entry of `variant.branchPrefixes` is empty or does not end in `/`
- **THEN** loading the configuration fails validation

### Requirement: Container engine and browser opening
The system SHALL accept an optional `variant.containerEngine`, either `docker` or `podman`, and an optional boolean `variant.open`, defaulting to `true`. The environment variable `CONTAINER_ENGINE` SHALL take precedence over `variant.containerEngine`. When neither is set, the engine SHALL be `docker` when a `docker` executable is found on `PATH`, otherwise `podman`, otherwise container commands SHALL fail with an error that names both. The environment variable `VARIANT_OPEN=0` SHALL take precedence over `variant.open`.

#### Scenario: Configured engine

- **WHEN** `variant.containerEngine` is `podman` and `CONTAINER_ENGINE` is unset
- **THEN** container commands run with `podman`

#### Scenario: Environment engine wins

- **WHEN** `variant.containerEngine` is `podman` and `CONTAINER_ENGINE` is `docker`
- **THEN** container commands run with `docker`

#### Scenario: No engine

- **WHEN** neither option nor variable is set and neither `docker` nor `podman` is on `PATH`
- **THEN** a container command fails with an error naming `docker` and `podman`

#### Scenario: Opening disabled

- **WHEN** `variant.open` is `false`, or `VARIANT_OPEN` is `0`
- **THEN** the resolved configuration reports that URLs are not opened

#### Scenario: Invalid engine

- **WHEN** `variant.containerEngine` is `nerdctl`
- **THEN** loading the configuration fails validation

### Requirement: Variant storage
The system SHALL accept an optional `variant.storage` with `dir`, a path relative to the worktree defaulting to `.storage`, and `env`, the name of an environment variable that carries the absolute storage directory to commands, defaulting to `STORAGE_ROOT`. When `variant.storage` is absent a variant has no storage directory, `{{storage}}` is empty, and no storage environment variable is set. A `dir` that is absolute or climbs out of the worktree SHALL fail validation.

#### Scenario: Defaults

- **WHEN** `variant.storage` is `{}`
- **THEN** the resolved directory is `.storage` and the variable is `STORAGE_ROOT`

#### Scenario: Escaping directory

- **WHEN** `variant.storage.dir` is `../shared`
- **THEN** loading the configuration fails validation

#### Scenario: No storage

- **WHEN** `variant.storage` is absent
- **THEN** the resolved configuration has no storage settings

### Requirement: Supervision settings
The system SHALL accept an optional `variant.supervise` with `startDelaySeconds` (default 2), `readyTimeoutSeconds` (default 180) and `checkoutPollSeconds` (default 5). The delay SHALL be the wait between starting one watched instance and the next. `readyTimeoutSeconds` SHALL be the wait for the instances that set `ready`. A `checkoutPollSeconds` of 0 SHALL disable the checkout check. Negative numbers SHALL fail validation.

#### Scenario: Defaults

- **WHEN** `variant.supervise` is absent
- **THEN** the resolved values are 2, 180 and 5

#### Scenario: Negative value

- **WHEN** `variant.supervise.startDelaySeconds` is `-1`
- **THEN** loading the configuration fails validation

### Requirement: Implode settings
The system SHALL accept an optional `variant.implode` with `preRm` (a list of directory names), `restore` (a list of file names), `untracked` (a list of glob patterns that may hold `{{slug}}`), `requireMerged` (boolean, default `true`) and `maxDiffLines` (non-negative integer, default 200). `preRm` entries and `restore` entries SHALL NOT contain a path separator or climb out of a directory. `preRm`, `restore` and `untracked` SHALL default to empty lists. The resolved configuration SHALL always carry `requireMerged` and `maxDiffLines`.

#### Scenario: Example settings

- **WHEN** `variant.implode.preRm` is `[dist, node_modules, .cache, out]` and `restore` is `[package-lock.json, bun.lock]`
- **THEN** loading succeeds and the resolved lists equal those values

#### Scenario: Defaults

- **WHEN** `variant.implode` is absent
- **THEN** the resolved lists are empty, `requireMerged` is `true` and `maxDiffLines` is 200

#### Scenario: Path in a name

- **WHEN** a `preRm` entry is `a/b` or `..`
- **THEN** loading the configuration fails validation
