# meta/local-checks Specification

## Purpose

How the repository's local checks run through `hk`: each package contributes its own lint, format and test steps, the
repository contributes the workspace-wide steps, and three `task` entry points select the scope. Contributors and CI see the same
step names.

## Requirements

### Requirement: Every package owns its lint and test steps

Every directory `packages/<name>` that has a `package.json` SHALL have a `packages/<name>/hk.pkl`, and the root
`hk.pkl` SHALL include every such directory under `subprojects`. The `hk check --all --plan` output SHALL contain one Biome
step per package, named with that package, and SHALL NOT contain a Biome step that spans several packages. Each
package's `hk.pkl` SHALL contribute that Biome step to the `check`, `fix` and `pre-commit` hooks, and a `test` step to the
`check` hook, from one shared definition, so changing a step once changes it for every package. A package's `test`
step SHALL run that package's own test script from the package directory.

#### Scenario: Plan lists a Biome step per package

- **WHEN** `hk check --all --plan` runs at the repository root
- **THEN** the plan selects a Biome step for each directory under `packages/`
- **AND** no selected Biome step is named without a package

#### Scenario: Plan lists a test step per package

- **WHEN** `hk check --all --profile ci --plan` runs at the repository root
- **THEN** the plan selects a `test` step for each directory under `packages/`, named with that package

#### Scenario: Package missing from the configuration

- **WHEN** `packages/<name>/package.json` exists and `packages/<name>/hk.pkl` is missing, or the root `subprojects` does not include it
- **THEN** the contract test for the local checks fails and names `packages/<name>`

#### Scenario: Package lints only its own files

- **WHEN** a staged file is `packages/variant-api/src/index.ts`
- **THEN** `hk run pre-commit --plan` selects the Biome step of `variant-api`
- **AND** selects no Biome step of another package

### Requirement: Profiles select the heavy checks

The package `test` steps, the workspace `build`, the root script tests and `commitlint` SHALL run in the `ci` profile
only, and `docs:build` SHALL run in the `full` profile only. The default `check` plan and the `pre-commit` plan SHALL
contain none of them. The package `test` steps SHALL depend on the workspace `build` step, and SHALL NOT depend on
each other, so that they start when the build has finished and run concurrently. The `pre-commit` and `fix`
hooks SHALL run only the per-package Biome steps. The `commit-msg` hook SHALL run commitlint on the message file.

#### Scenario: Default check is quick

- **WHEN** `hk check --all --plan` runs without a profile
- **THEN** the plan selects the per-package Biome steps
- **AND** does not select a `test` step, `build`, `commitlint` or `docs:build`

#### Scenario: CI profile

- **WHEN** `hk check --all --profile ci --plan` runs
- **THEN** the plan also selects the package `test` steps, `build`, the root script tests and `commitlint`
- **AND** does not select `docs:build`

#### Scenario: Tests wait for the build, not for each other

- **WHEN** `hk check --all --profile ci` runs
- **THEN** no package `test` step starts before `build` has finished
- **AND** the package `test` steps run at the same time

#### Scenario: Full profile

- **WHEN** `hk check --all --profile ci --profile full --plan` runs
- **THEN** the plan also selects `docs:build`

#### Scenario: Pre-commit

- **WHEN** `hk run pre-commit --plan` runs
- **THEN** the plan selects only Biome steps

### Requirement: Workflow lint and extension packaging are hk steps

The root `hk.pkl` SHALL contain a `lint:workflows` step (lint of the GitHub Actions workflows) in the `ci` profile, and a `package:vsix` step (both extensions packaged into `out/*.vsix`) in the `full` profile. The `package:vsix` step SHALL depend on the workspace `build` step and SHALL NOT build again. The CI workflow for feature branches SHALL run these checks only through `task check:full`, and SHALL still attach the packaged `.vsix` files to the run.

#### Scenario: Plans

- **WHEN** `hk check --all --profile ci --plan` runs
- **THEN** the plan selects `lint:workflows` and does not select `package:vsix`
- **AND** with `--profile full` added the plan also selects `package:vsix`

#### Scenario: Default check

- **WHEN** `hk check --all --plan` runs without a profile
- **THEN** the plan selects neither `lint:workflows` nor `package:vsix`

#### Scenario: Writers run after the tests

- **WHEN** `hk check --all --profile ci --profile full --plan` runs
- **THEN** `test:scripts` depends on `build` and on every package's test step
- **AND** `docs:build` and `package:vsix` each depend on `build`, `test:scripts` and every package's test step
- **AND** no step that rewrites a `dist/` or `out/` that package tests read runs beside them

#### Scenario: Workflow

- **WHEN** the feature-branch CI workflow runs
- **THEN** it does not call `task lint:workflows` or `task package:vsix` itself
- **AND** the run still has the `vsix` artifact

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
