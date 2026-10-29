## ADDED Requirements

### Requirement: CLI reports the package version

The `variant` CLI SHALL report the `version` of the `variant-api` package, not a fixed number. `variant --version` SHALL print that version alone, and the first line of `variant --help` SHALL be `variant v` followed by it. This SHALL hold when the CLI runs from source, from the built `dist/`, and from the compiled single-file executable.

#### Scenario: Version flag

- **WHEN** a user runs `variant --version`
- **THEN** the output is the `version` in the `variant-api` `package.json`

#### Scenario: Help header

- **WHEN** a user runs `variant --help`
- **THEN** the first line is `variant v` followed by the `version` in the `variant-api` `package.json`
