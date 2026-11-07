# meta/ci-feature-builds Specification

## Purpose

Define what a feature-branch build verifies, so a reviewer can trust the green check on a pull request as proof that the change passes every repository gate and still packages into the shippable artifacts.

## Requirements

### Requirement: Full gate run on feature branches

The CI workflow SHALL run on every push to a branch other than `main`. Pushes to `main` run the same workflow through the release workflow, so the gate runs once per `main` push. Opening or updating a pull request targeting `main` SHALL NOT start a second run; the pull request SHALL show the gate result of the push of its head. The workflow SHALL run the repository's complete check gate (install from the frozen lockfile, lint, build, test, commit message lint over the range since `main`, and docs build) by invoking the same `task` targets a contributor runs locally.

#### Scenario: Push to a feature branch

- **WHEN** a commit is pushed to a branch other than `main`
- **THEN** the CI workflow runs the full gate
- **AND** the check fails if any gate fails

#### Scenario: Pull request

- **WHEN** a pull request targeting `main` is opened or its head is updated
- **THEN** the checks on that head are the checks from the push of that commit
- **AND** the CI workflow does not start a run for the pull request event

#### Scenario: Superseded run

- **WHEN** a newer commit is pushed to the same non-`main` branch while an earlier run is in progress
- **THEN** the earlier run is cancelled

### Requirement: Extension packages on feature branches

The CI workflow SHALL, in the same run, package both extensions as `.vsix` files and attach them to the run as downloadable artifacts. It SHALL NOT compile a `variant` executable, SHALL NOT run one, and SHALL NOT attach one.

#### Scenario: Packages build

- **WHEN** the CI workflow succeeds
- **THEN** the run has artifacts containing the variant-worktrees `.vsix` and the chat-renamer `.vsix`
- **AND** the run has no `variant` executable

#### Scenario: Packaging failure fails the build

- **WHEN** a `.vsix` cannot be packaged
- **THEN** the CI workflow fails

### Requirement: Reusable by release

The CI workflow SHALL be callable from other workflows so the release workflow reuses the identical gate instead of a copy.

#### Scenario: Release calls CI

- **WHEN** the release workflow runs for a push to `main`
- **THEN** it runs the CI workflow first and continues only if it succeeds

### Requirement: Workflow actions run on the supported Node runtime

Every GitHub Action that the workflows under `.github/workflows/` use SHALL be pinned to a major version that runs on the Node.js 24 runtime (or is a composite action), so a run reports no annotation that an action targets a deprecated Node.js runtime. The actions are `actions/checkout`, `actions/upload-artifact`, `actions/download-artifact`, `jdx/mise-action`, `oven-sh/setup-bun`, `actions/upload-pages-artifact`, `actions/deploy-pages` and `azure/login` (when enabled).

#### Scenario: Run without Node deprecation annotations

- **WHEN** the CI workflow runs on a feature branch
- **THEN** its annotations hold no warning that an action targets Node.js 20
