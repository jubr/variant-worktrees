## MODIFIED Requirements

### Requirement: Provisioning order

The system SHALL provision a variant in this order, stopping at the first failure: watch dependency installs, watch env file copies, the `up` commands of the watches, and the entries of `variant.steps` in listed order. Every command SHALL run in its configured directory with the command environment. A failure SHALL report the step `name` (or the command) that failed, its exit status and its output, and SHALL NOT run later commands.

#### Scenario: Steps between up and seed

- **WHEN** a watch has `up`, two steps are configured and the second is named `seed`
- **THEN** the commands run as `up`, step one, step two (`seed`)

#### Scenario: Step failure stops provisioning

- **WHEN** the first of two steps exits with status 3
- **THEN** provisioning fails naming that step and status 3, and the second step does not run

#### Scenario: Step directory

- **WHEN** a step sets `dir: server` for a worktree `/w`
- **THEN** its command runs in `/w/server`

