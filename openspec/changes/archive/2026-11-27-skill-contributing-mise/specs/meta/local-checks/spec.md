## ADDED Requirements

### Requirement: Mise minimum version

The repository's `mise.toml` SHALL set `min_version` to a Mise release that supports every tool backend it uses. Because it installs `variant` through the `packslip:` backend, `min_version` SHALL be no lower than `2026.9.2`, the first release with that backend. A Mise older than `min_version` SHALL stop with Mise's own minimum-version error before it installs any tool.

#### Scenario: Backend release is the floor

- **WHEN** `mise.toml` lists a tool with the `packslip:` prefix
- **THEN** its top-level `min_version` is `2026.9.2` or higher

#### Scenario: Older Mise stops early

- **WHEN** a Mise older than `min_version` runs `mise install` in the repository
- **THEN** it fails with an error that names the required version
- **AND** it installs no tool
