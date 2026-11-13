## Purpose

How the repository's local checks run through `hk`: each package contributes its own lint and format step, the repository
contributes the workspace-wide steps, and three `task` entry points select the scope. Contributors and CI see the same
step names.

## ADDED Requirements

### Requirement: Every package owns its lint step

Every directory `packages/<name>` that has a `package.json` SHALL have a `packages/<name>/hk.pkl`, and the root
`hk.pkl` SHALL list `packages/<name>` under `subprojects`. The `hk check --all --plan` output SHALL contain one Biome
step per package, named with that package, and SHALL NOT contain a Biome step that spans several packages. Each
package's `hk.pkl` SHALL contribute that Biome step to the `check`, `fix` and `pre-commit` hooks from one shared
definition, so changing the step once changes it for every package.

#### Scenario: Plan lists a Biome step per package

- **WHEN** `hk check --all --plan` runs at the repository root
- **THEN** the plan selects a Biome step for each directory under `packages/`
- **AND** no selected Biome step is named without a package

#### Scenario: Package missing from the configuration

- **WHEN** `packages/<name>/package.json` exists and `packages/<name>/hk.pkl` is missing, or the root `subprojects` omits it
- **THEN** the contract test for the local checks fails and names `packages/<name>`

#### Scenario: Package lints only its own files

- **WHEN** a staged file is `packages/variant-api/src/index.ts`
- **THEN** `hk run pre-commit --plan` selects the Biome step of `variant-api`
- **AND** selects no Biome step of another package

### Requirement: Profiles select the heavy checks

The steps `test`, `build` and `commitlint` SHALL run in the `ci` profile only, and `docs:build` SHALL run in the `full`
profile only. The default `check` plan and the `pre-commit` plan SHALL contain none of them. The `pre-commit` and `fix`
hooks SHALL run only the per-package Biome steps. The `commit-msg` hook SHALL run commitlint on the message file.

#### Scenario: Default check is quick

- **WHEN** `hk check --all --plan` runs without a profile
- **THEN** the plan selects the per-package Biome steps
- **AND** does not select `test`, `build`, `commitlint` or `docs:build`

#### Scenario: CI profile

- **WHEN** `hk check --all --profile ci --plan` runs
- **THEN** the plan also selects `test`, `build` and `commitlint`
- **AND** does not select `docs:build`

#### Scenario: Full profile

- **WHEN** `hk check --all --profile ci --profile full --plan` runs
- **THEN** the plan also selects `docs:build`

#### Scenario: Pre-commit

- **WHEN** `hk run pre-commit --plan` runs
- **THEN** the plan selects only Biome steps

### Requirement: Task entry points for the checks

`Taskfile.yaml` SHALL offer `check:changed` (`hk check` on git-changed files, no install), `check:all` (`hk check --all
--profile ci`, no install) and `check:full` (workspace install, then `hk check --all --profile ci --profile full`). Each
SHALL have a description that names what it runs. `CONTRIBUTING.md` SHALL list the three tasks with those meanings, and
`AGENTS.md` SHALL name them in its hk guidance.

#### Scenario: Tasks listed

- **WHEN** `task --list` runs
- **THEN** `check:changed`, `check:all` and `check:full` appear with descriptions

#### Scenario: Install only in the full task

- **WHEN** `task check:all` runs
- **THEN** it does not run `bun install`
- **AND** `task check:full` runs the install first
