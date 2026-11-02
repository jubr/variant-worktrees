## MODIFIED Requirements

### Requirement: Implode cleanup

The system SHALL, before the worktree report is taken and the worktree is removed, delete every path that matches a pattern of `variant.implode.preRm`, with `{{slug}}` replaced. A pattern SHALL be matched relative to the project directory and relative to each instance directory, so `dist` removes `fe/dist` and `be/dist` of instances in `fe` and `be`, and a dotfile or a directory such as `node_modules` is matched like any other name. A match that is, or contains, a file tracked by git SHALL be left in place. The system SHALL discard local modifications of tracked files whose base name is in `variant.implode.discard`, leaving other modified files as they are.

#### Scenario: Pre-removal directories

- **WHEN** `preRm` is `[dist, node_modules]`, an instance `fe` has `fe/dist` and `fe/node_modules`, and `implode` runs
- **THEN** both directories are gone before the worktree is removed

#### Scenario: Root directories

- **WHEN** `preRm` is `[node_modules]` and the project directory holds an untracked `node_modules`
- **THEN** it is deleted too

#### Scenario: Untracked recording removed

- **WHEN** `preRm` is `["openspec/changes/{{slug}}/pr*-demo.webm"]` and an untracked `openspec/changes/demo/pr7-demo.webm` exists
- **THEN** the file is deleted

#### Scenario: Tracked file with matching name kept

- **WHEN** a tracked file matches a `preRm` pattern, or a matching directory contains one
- **THEN** it is not deleted

#### Scenario: Removal precedes the report

- **WHEN** an untracked file matches a `preRm` pattern
- **THEN** the implode report does not list it

#### Scenario: Lockfile restored

- **WHEN** `discard` is `[bun.lock]` and the tracked `bun.lock` in the worktree is modified
- **THEN** its modification is discarded before the worktree is removed

#### Scenario: Other modifications left

- **WHEN** a tracked `src/a.ts` is modified and not listed
- **THEN** it is unchanged, and without `force` the worktree removal fails because of the dirty file
