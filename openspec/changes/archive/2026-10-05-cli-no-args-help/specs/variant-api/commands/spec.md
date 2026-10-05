## MODIFIED Requirements

### Requirement: CLI routing from commands

The system SHALL auto-generate cleye CLI routing from the `commands[]` array.

#### Scenario: CLI discovers commands
- **WHEN** the CLI boots
- **THEN** each `commands[i]` becomes a cleye subcommand

#### Scenario: No arguments show help
- **WHEN** a user runs `variant` without arguments
- **THEN** the CLI produces the same top-level command help as `variant --help`

#### Scenario: Arg parsing
- **WHEN** a user runs `variant create --slug test-feature`
- **THEN** `execute()` receives `{ slug: "test-feature" }`
