## ADDED Requirements

### Requirement: Worktree directory prefix

The system SHALL accept an optional `variant.worktreePrefix` in `variants.yaml`, a non-empty string without path separators, naming the prefix of worktree directories (`<prefix>-<slug>`). When absent it SHALL default to `_v`. The resolved configuration SHALL always carry the prefix. The system SHALL also offer a lightweight reader that returns only the prefix for a directory, without resolving database settings, and returns `_v` when no configuration file exists or the file cannot be read or is invalid.

#### Scenario: Default prefix

- **WHEN** `variants.yaml` does not define `variant.worktreePrefix`
- **THEN** the resolved prefix is `_v`

#### Scenario: Custom prefix

- **WHEN** `variants.yaml` defines `variant.worktreePrefix: _work`
- **THEN** the resolved prefix is `_work`

#### Scenario: Invalid prefix

- **WHEN** `variant.worktreePrefix` is empty or contains `/`
- **THEN** loading the configuration fails validation

#### Scenario: Reading only the prefix

- **WHEN** the lightweight reader is called for a directory below a `variants.yaml` that defines `_work`
- **THEN** it returns `_work` without requiring any database settings

#### Scenario: No configuration

- **WHEN** the lightweight reader is called and no `variants.yaml` exists above the directory
- **THEN** it returns `_v`
