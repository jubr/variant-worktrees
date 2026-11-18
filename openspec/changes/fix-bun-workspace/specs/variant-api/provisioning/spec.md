## ADDED Requirements

### Requirement: The worktree placeholder is an absolute path

The system SHALL expand `${worktree}` to an absolute, normalized path of the worktree of the variant, wherever the placeholder is accepted (`env` of a step, `env.overrides` of a watch, `multi.tenantsCmd`, step and watch commands). The path SHALL NOT depend on how the current directory, `variant.main` or `variant.root` was given: a relative value, a value with `.` or `..` segments, or a trailing separator SHALL give the same expansion as its absolute, normalized form. For a variant without a worktree the placeholder SHALL be the root of the git checkout that holds the current directory, made absolute in the same way.

#### Scenario: Relative current directory

- **WHEN** the client is created with the relative `cwd` `../_v-demo` and a watch has `env.overrides` `SQLITE_DATABASE: '${worktree}/.cache/variant/${schema}.sqlite'`
- **THEN** the value the watch receives starts with the absolute path of that directory and holds no `..` segment

#### Scenario: Relative main checkout

- **WHEN** `variant.main` is `./variant-worktrees` and the slug is `main`
- **THEN** `${worktree}` expands to the absolute path of that checkout

#### Scenario: Same file from any directory

- **WHEN** provisioning ran from the project root and the watch is started from a subdirectory of the worktree
- **THEN** both expand `${worktree}` to the same absolute path
