## ADDED Requirements

### Requirement: Worktree prefix

The system SHALL name worktree directories `<prefix><slug>` using the resolved `variant.prefix`, which defaults to `_v-` and already holds its connector.

#### Scenario: Default prefix

- **WHEN** `create("add-auth")` requires a worktree and no prefix is configured
- **THEN** the worktree directory is named `_v-add-auth`

#### Scenario: Configured prefix

- **WHEN** `variant.prefix` is `_work-` and `create("add-auth")` requires a worktree
- **THEN** the worktree directory is named `_work-add-auth`

### Requirement: Instance commands run in the instance directory

The system SHALL run the `up` command of an entry of `variant.instances` during provisioning with the instance's `dir`, resolved against the variant's worktree, as its working directory. The variant-wide `up` command used when no instances exist, and the seed command, SHALL run in the worktree root.

#### Scenario: Instance command runs in its directory

- **WHEN** an instance with `dir: be` and `up: pwd` is provisioned in a worktree `/w`
- **THEN** the command runs in `/w/be`

#### Scenario: Seed runs in the worktree root

- **WHEN** a variant with instances and a seed command is provisioned
- **THEN** the seed command runs in the worktree root
