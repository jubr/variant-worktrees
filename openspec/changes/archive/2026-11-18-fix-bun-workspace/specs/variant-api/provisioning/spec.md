## ADDED Requirements

### Requirement: The worktree placeholder is an absolute path

The system SHALL expand `${worktree}` to an absolute, normalized path of the worktree of the variant, wherever the placeholder is accepted (`env` of a step, `env.overrides` of a watch, `multi.tenantsCmd`, step and watch commands). The path SHALL NOT depend on how the worktree was spelled to the run: a relative value, a value with `.` or `..` segments, or a trailing separator SHALL give the same expansion as its absolute, normalized form.

#### Scenario: Relative worktree

- **WHEN** a run is prepared for the relative worktree `../x/./_v-demo/` and a watch has `env.overrides` `SQLITE_DATABASE: '${worktree}/.cache/variant/${schema}.sqlite'`
- **THEN** the value the watch receives starts with the absolute path of that directory and holds no `.` or `..` segment

#### Scenario: Same file from any spelling

- **WHEN** two runs name the same worktree, one by its absolute path and one by a relative path with `..` segments
- **THEN** both expand `${worktree}` to the same absolute path
