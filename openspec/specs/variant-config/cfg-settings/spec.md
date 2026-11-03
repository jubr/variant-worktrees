# variant-config/cfg-settings Specification

## Purpose
Workspace-wide `variants.yaml` settings for variant lifecycle: branch naming, container engine and browser opening, storage, supervision timing and implode cleanup, each with defaults and validation.

## Requirements

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

### Requirement: Project abbreviation

The system SHALL accept an optional `variant.abbr`, a string of lowercase letters and digits, optionally separated by single `-`, that labels the project in hostnames and `open` URL templates. When it is absent the system SHALL derive it from the base name of the main checkout directory: split the name into words at every character that is not a letter or digit and at every lowercase-to-uppercase boundary, take the first letter or digit of each word, and lowercase the result. A name without any letter or digit SHALL give `app`. The resolved configuration SHALL always carry the abbreviation. An explicit value that does not match the pattern SHALL fail validation.

#### Scenario: Hyphenated name

- **WHEN** `variant.abbr` is absent and the main checkout directory is `variant-worktrees`
- **THEN** the resolved abbreviation is `vw`

#### Scenario: Title case name

- **WHEN** `variant.abbr` is absent and the main checkout directory is `OtherTitleCase`
- **THEN** the resolved abbreviation is `otc`

#### Scenario: Camel case name

- **WHEN** `variant.abbr` is absent and the main checkout directory is `moreStuff`
- **THEN** the resolved abbreviation is `ms`

#### Scenario: Underscore name

- **WHEN** `variant.abbr` is absent and the main checkout directory is `lower_example`
- **THEN** the resolved abbreviation is `le`

#### Scenario: Single word

- **WHEN** `variant.abbr` is absent and the main checkout directory is `shop`
- **THEN** the resolved abbreviation is `s`

#### Scenario: Linked checkout layout

- **WHEN** the configuration is loaded from the worktree `/work/vw/_v-add-auth` of the main checkout `/work/vw/variant-worktrees`
- **THEN** the resolved abbreviation is `vw`

#### Scenario: Explicit value wins

- **WHEN** `variant.abbr` is `shop` and the main checkout directory is `variant-worktrees`
- **THEN** the resolved abbreviation is `shop`

#### Scenario: Invalid value

- **WHEN** `variant.abbr` is `Shop`, `a.b` or an empty string
- **THEN** loading the configuration fails validation

#### Scenario: Nothing to abbreviate

- **WHEN** `variant.abbr` is absent and the main checkout directory is `___`
- **THEN** the resolved abbreviation is `app`

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

### Requirement: Port range
The system SHALL accept an optional `variant.ports` object with the optional string `range`, written `<low>-<high>` with both ends integers from 1024 to 65535 and `low` not above `high`, defaulting to `42000-42999`. The range SHALL be the set of ports from which free ports are picked for watches and for the `variant ui` server; no other port list or reservation exists. A `range` that is not of that form, has an end outside 1024 to 65535 or has `low` above `high` SHALL fail validation. The former key `variant.reservedPorts` SHALL be ignored with a warning. The resolved configuration SHALL always carry the range.

#### Scenario: Default range

- **WHEN** `variant.ports` is absent
- **THEN** the resolved range is `42000-42999`

#### Scenario: Custom range accepted

- **WHEN** `variant.ports.range` is `50000-50099`
- **THEN** loading succeeds and the resolved range is `50000-50099`

#### Scenario: Invalid range

- **WHEN** `variant.ports.range` is `42000`, `42999-42000`, `80-90` or `abc`
- **THEN** loading the configuration fails validation

#### Scenario: Former reserved ports

- **WHEN** `variant.reservedPorts` is `[3000]`
- **THEN** loading succeeds, the key takes no effect and one warning names it
