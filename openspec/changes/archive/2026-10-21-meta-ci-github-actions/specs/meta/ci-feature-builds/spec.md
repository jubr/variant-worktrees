## Purpose

Define what a feature-branch or pull-request build verifies, so a reviewer can trust a green check as proof that the change passes every repository gate and still packages into the shippable artifacts.

## ADDED Requirements

### Requirement: Full gate run on feature branches

The CI workflow SHALL run on every push to a branch other than `main` and on every pull request targeting `main`. Pushes to `main` run the same workflow through the release workflow, so the gate runs once per `main` push. It SHALL run the repository's complete check gate (install from the frozen lockfile, lint, build, test, commit message lint over the range since `main`, and docs build) by invoking the same `task` targets a contributor runs locally.

#### Scenario: Push to a feature branch

- **WHEN** a commit is pushed to a branch other than `main`
- **THEN** the CI workflow runs the full gate
- **AND** the check fails if any gate fails

#### Scenario: Pull request

- **WHEN** a pull request targeting `main` is opened or updated
- **THEN** the CI workflow runs the full gate against the pull request head

#### Scenario: Superseded run

- **WHEN** a newer commit is pushed to the same non-`main` branch while an earlier run is in progress
- **THEN** the earlier run is cancelled

### Requirement: Packaging proven on feature branches

The CI workflow SHALL, in the same run, package both extensions as `.vsix` files and compile the `variant` CLI to a single-file executable for macOS arm64 only (the pre-release binary; no other platform is built on feature branches). It SHALL build that executable on a macOS arm64 runner and execute it to confirm it starts. It SHALL attach these files to the run as downloadable artifacts.

#### Scenario: Packages build

- **WHEN** the CI workflow succeeds
- **THEN** the run has artifacts containing the variant-worktrees `.vsix`, the chat-renamer `.vsix`, and a `variant` executable for macOS arm64
- **AND** the run has no `variant` executable for any other platform

#### Scenario: Executable starts

- **WHEN** the compiled `variant` executable is run with `--help`
- **THEN** it exits successfully and prints its usage

#### Scenario: Packaging failure fails the build

- **WHEN** a `.vsix` cannot be packaged or the CLI cannot be compiled
- **THEN** the CI workflow fails

### Requirement: Reusable by release

The CI workflow SHALL be callable from other workflows so the release workflow reuses the identical gate instead of a copy.

#### Scenario: Release calls CI

- **WHEN** the release workflow runs for a push to `main`
- **THEN** it runs the CI workflow first and continues only if it succeeds
