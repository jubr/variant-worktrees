## ADDED Requirements

### Requirement: A hung gate fails

Every job of the CI workflow SHALL have a time limit well above a normal run, so that a hung test run fails the check instead of keeping it pending.

#### Scenario: Hung test run

- **WHEN** a gate step produces no result within the time limit
- **THEN** the job is cancelled and the check fails
