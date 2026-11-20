## MODIFIED Requirements

### Requirement: Commands groups lifecycle commands

The Commands page SHALL have the second-level sections *Lifecycle commands* and *Other commands*. *Lifecycle commands* SHALL hold `init` first, then `create`, `provision`, `up`, `watch`, `down`, `deprovision` and `implode` as third-level headings, in the order of the flow of steps after `init`. *Other commands* SHALL hold `config`, `list`, `status`, `ui` and `mcp` as third-level headings. Every command heading keeps the id of its name, so `commands#create` stays a valid deep link.

#### Scenario: Commands are grouped

- **WHEN** the headings of the built Commands page are listed in page order
- **THEN** the second-level headings are Lifecycle commands and Other commands
- **AND** the third-level headings below Lifecycle commands are `init`, `create`, `provision`, `up`, `watch`, `down`, `deprovision`, `implode`
- **AND** the third-level headings below Other commands are `config`, `list`, `status`, `ui`, `mcp`
