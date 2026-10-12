## ADDED Requirements

### Requirement: Worktree prefix

The system SHALL name worktree directories `<prefix>-<slug>` using the resolved `variant.worktreePrefix`, which defaults to `_v`.

#### Scenario: Default prefix

- **WHEN** `create("add-auth")` requires a worktree and no prefix is configured
- **THEN** the worktree directory is named `_v-add-auth`

#### Scenario: Configured prefix

- **WHEN** `variant.worktreePrefix` is `_work` and `create("add-auth")` requires a worktree
- **THEN** the worktree directory is named `_work-add-auth`
