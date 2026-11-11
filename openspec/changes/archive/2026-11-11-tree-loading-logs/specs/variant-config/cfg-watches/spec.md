## ADDED Requirements

### Requirement: Watch output mode

The system SHALL accept an optional `output` object on any entry of `variant.watches`. `output.mode` SHALL be `tty` or `no-tty`. Any other value SHALL fail validation. An absent `output`, or an `output` with no `mode`, SHALL leave the mode unset.

#### Scenario: Terminal mode accepted

- **WHEN** a watch sets `output: { mode: tty }`
- **THEN** loading succeeds and the resolved watch has output mode `tty`

#### Scenario: Plain mode accepted

- **WHEN** a watch sets `output: { mode: no-tty }`
- **THEN** loading succeeds and the resolved watch has output mode `no-tty`

#### Scenario: Other mode rejected

- **WHEN** a watch sets `output: { mode: color }`
- **THEN** loading the configuration fails validation

#### Scenario: Absent mode stays unset

- **WHEN** a watch sets no `output`
- **THEN** loading succeeds and the resolved watch has no output mode
