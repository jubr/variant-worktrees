## MODIFIED Requirements

### Requirement: A hung gate fails

Every job of the CI workflow that runs steps itself SHALL have a time limit well above a normal run, so that a hung test run fails the check instead of keeping it pending. A job of the CI workflow that calls another workflow SHALL leave the limit to that workflow, every job of which SHALL have a time limit.

#### Scenario: Hung test run

- **WHEN** a gate step produces no result within the time limit
- **THEN** the job is cancelled and the check fails

#### Scenario: Called workflow

- **WHEN** the CI workflow calls another workflow
- **THEN** every job of the called workflow has a time limit
