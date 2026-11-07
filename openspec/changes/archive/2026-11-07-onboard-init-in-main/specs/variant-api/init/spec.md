## MODIFIED Requirements

### Requirement: Init command

The system SHALL provide the command `init` in `variant-api`, reachable as `variant init` and as the MCP tool
`variant_init`, which runs in-process and not through the editor socket. It SHALL take an optional string `prefix`
(default `_v-`), three booleans that default to true and turn one step off each when false (`file`: write
`variants.yaml`; `gitignore`: add the worktree pattern to `.gitignore`; `mise`: augment the mise configuration with the CLI), and a
boolean `force`. It SHALL act on the current directory. When the editor runs it, that directory SHALL be the onboarding
directory in [specs/variant-vscode/onboarding | Init runs in the main checkout](../../variant-vscode/onboarding/spec.md#requirement-init-runs-in-the-main-checkout).
The CLI and the MCP tool SHALL keep using the process working directory. It SHALL return what each
step did: the path of the written file or `null`, whether `.gitignore` and the mise configuration changed, and the detected
values. A `prefix` that is empty or contains a path separator SHALL be refused before anything is written.

#### Scenario: Defaults

- **WHEN** a person runs `variant init` in a directory without `variants.yaml`
- **THEN** `variants.yaml` is written with `variant.prefix: _v-`, `.gitignore` gains `_v-*` and the mise
  configuration lists the CLI

#### Scenario: Custom prefix

- **WHEN** a person runs `variant init --prefix wt-`
- **THEN** the file has `variant.prefix: wt-` and `.gitignore` gains `wt-*`

#### Scenario: Invalid prefix

- **WHEN** a person runs `variant init --prefix a/b`
- **THEN** the command fails naming the prefix and writes nothing

#### Scenario: Skipping a step

- **WHEN** a person runs `variant init --gitignore=false --mise=false`
- **THEN** only `variants.yaml` is written, and each other step can be skipped the same way

#### Scenario: Editor initializes the main checkout

- **WHEN** the editor runs `init` and the onboarding directory is a checkout other than the opened folder
- **THEN** `variants.yaml` is written in that checkout
- **AND** the opened folder is unchanged
