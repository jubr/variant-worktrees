## ADDED Requirements

### Requirement: Implode modal names the branch

The native implode confirmation SHALL name the variant and SHALL say that the database target, the worktree, and the branch are removed. Accepting it SHALL call `implode` without a branch choice, so the implode default applies.

#### Scenario: Modal names the branch

- **WHEN** a person presses the explosion control on a clean `demo`
- **THEN** the modal detail says the branch of `demo` is removed
