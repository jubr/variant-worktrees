## ADDED Requirements

### Requirement: Commands belong to a documentation section

Every command SHALL belong to one section, `basic`, `lifecycle` or `cli`, which names where the documentation lists it. Every `CommandDefinition` SHALL carry `section` with the value `basic` or `lifecycle`: `init`, `config`, `list` and `status` are `basic`; `create`, `provision`, `up`, `watch`, `down`, `deprovision` and `implode` are `lifecycle`. The commands only the CLI offers, `ui`, `mcp` and `completions`, SHALL be in section `cli`. The section SHALL NOT change what a command does or how it is routed.

#### Scenario: Every registered command has a section

- **WHEN** the command registry is read
- **THEN** each command has `section` equal to `basic` or `lifecycle`
- **AND** the `basic` commands are `init`, `config`, `list`, `status` and the `lifecycle` commands are `create`, `provision`, `up`, `watch`, `down`, `deprovision`, `implode`

#### Scenario: CLI-only commands are in section cli

- **WHEN** the CLI-only commands are listed with their sections
- **THEN** `ui`, `mcp` and `completions` are each in section `cli`
