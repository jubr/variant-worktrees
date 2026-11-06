## ADDED Requirements

### Requirement: Status while the database cannot be contacted

When the configured database cannot be contacted and the slug is known from a state file or a worktree, `status` SHALL succeed and return that record. When the slug is not known from a state file or a worktree, `status` SHALL fail with the database contact warning, the process SHALL exit non-zero, and the error SHALL NOT contain a SQL statement. The error SHALL NOT claim the slug is unknown as the reason.

#### Scenario: State file is enough

- **WHEN** variant `demo` has a state file, the configured database cannot be contacted, and a user runs `variant status demo`
- **THEN** the result has slug `demo` and the process exits 0

#### Scenario: Only a schema

- **WHEN** the database holds schema `v_ghost`, no state file or worktree names `ghost`, the database cannot be contacted, and a user runs `variant status ghost`
- **THEN** the command fails with the contact warning, the text does not contain `SELECT`, and the process exits non-zero
