## MODIFIED Requirements

### Requirement: Seed command configuration

The system SHALL allow `variants.yaml` to define a seed command per variant (`variants.<slug>.seed`) or for all variants (`variant.seed`). The former top-level `seed` key SHALL no longer be accepted.

#### Scenario: Global seed command
- **WHEN** `variants.yaml` has `variant.seed: "bun run db:seed"`
- **THEN** `variant provision` executes that command with variant environment

#### Scenario: Per-variant seed override
- **WHEN** config has `variants.main.seed = "echo skip"` and `variant.seed = "bun run db:seed"`
- **THEN** provisioning slug `main` runs `echo skip`

#### Scenario: Former top-level seed
- **WHEN** `variants.yaml` has a top-level `seed` key
- **THEN** loading the configuration fails validation

## ADDED Requirements

### Requirement: Instance open URL

The system SHALL accept an optional `open` string on each entry of `variant.instances`: a URL template that may contain the placeholders `{{slug}}` and `{{port}}`, for example `http://{{slug}}.vw.localhost:{{port}}`. The value SHALL be validated as a non-empty string and carried unchanged in the resolved configuration; this change does not launch it.

#### Scenario: Open template accepted

- **WHEN** an instance sets `open: http://{{slug}}.vw.localhost:{{port}}`
- **THEN** loading succeeds and the resolved instance carries that exact string

#### Scenario: Empty open template

- **WHEN** an instance sets `open: ""`
- **THEN** loading the configuration fails validation

### Requirement: Variant name prefix

The system SHALL accept an optional `variant.prefix` in `variants.yaml`, a non-empty string without path separators, that starts every name derived from a variant slug (`<prefix><slug>`): worktree directories today, and other per-variant names such as database schemas later. The prefix SHALL carry its own leading character and connector, for example `_v-`, so no consumer inserts a separator. When absent it SHALL default to `_v-`. The default SHALL be defined in `variant-config`. The resolved configuration SHALL always carry the prefix. The system SHALL also offer a lightweight reader that returns only the prefix for a directory, without resolving database settings, and returns `_v-` when no configuration file exists or the file cannot be read or is invalid.

#### Scenario: Default prefix

- **WHEN** `variants.yaml` does not define `variant.prefix`
- **THEN** the resolved prefix is `_v-`

#### Scenario: Custom prefix

- **WHEN** `variants.yaml` defines `variant.prefix: _work-`
- **THEN** the resolved prefix is `_work-`

#### Scenario: Invalid prefix

- **WHEN** `variant.prefix` is empty or contains `/`
- **THEN** loading the configuration fails validation

#### Scenario: Reading only the prefix

- **WHEN** the lightweight reader is called for a directory below a `variants.yaml` that defines `_work-`
- **THEN** it returns `_work-` without requiring any database settings

#### Scenario: No configuration

- **WHEN** the lightweight reader is called and no `variants.yaml` exists above the directory
- **THEN** it returns `_v-`

### Requirement: Chat renamer section

The system SHALL accept an optional top-level `chatRenamer` section in `variants.yaml` that carries the full set of options of `chat-renamer-config`: `trigger`, `hookScope`, `activationPatterns`, `worktreePrefixes` and `renameExistingDays`, each optional and validated by the schema owned by `chat-renamer-config`. Unknown keys inside the section SHALL fail validation. The system SHALL offer a lightweight reader that returns only this section for a directory, and an empty section when no configuration file exists or the file cannot be read or is invalid.

#### Scenario: Section with every option

- **WHEN** `variants.yaml` sets all five `chatRenamer` options to valid values
- **THEN** loading succeeds and the section is available unchanged

#### Scenario: Invalid option

- **WHEN** `chatRenamer.renameExistingDays` is `-1`
- **THEN** loading the configuration fails validation

#### Scenario: Unknown option

- **WHEN** `chatRenamer` contains a key that is not one of the five options
- **THEN** loading the configuration fails validation

#### Scenario: Reading only the section

- **WHEN** the lightweight reader is called for a directory below a `variants.yaml` that sets `chatRenamer.renameExistingDays: 30`
- **THEN** it returns `{ renameExistingDays: 30 }` without requiring any database settings

#### Scenario: No configuration

- **WHEN** the lightweight reader is called and no `variants.yaml` exists above the directory
- **THEN** it returns an empty section

### Requirement: Example configuration

The package SHALL ship `variants.example.yaml` next to `variants.yaml.schema.json`, specifying every option of the schema with an illustrative default and listing alternatives in end-of-line comments. The example SHALL validate against the schema, and a test SHALL fail when the schema holds an option the example omits.

#### Scenario: Example validates

- **WHEN** `variants.example.yaml` is parsed and validated
- **THEN** validation succeeds

#### Scenario: Example covers the schema

- **WHEN** an option is added to the schema and not to the example
- **THEN** the coverage test fails and names the missing option
