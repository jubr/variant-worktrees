## Purpose

Build the slim Bun runtime from an upstream pull request on GitHub-hosted runners, only when that pull request or the build recipe changed, so release builds can embed it without repeating a long compile.

## ADDED Requirements

### Requirement: Build only when the pull request head or the workflow changed

The repository SHALL have a workflow `.github/workflows/bun-standalone.yaml` that resolves the head commit of upstream Bun pull request 32262 and compiles the `bun-standalone` runtime from that commit. It SHALL compile for a platform only when no cached build exists for the pair of that head commit and the content hash of the workflow file. It SHALL run on a schedule, by manual dispatch, on a push that changes the workflow file, and when called by another workflow; it SHALL NOT run for pull requests of this repository. A run that finds a cached build SHALL NOT install a toolchain or compile. When the pull request head cannot be resolved, the run SHALL fail.

#### Scenario: Nothing changed

- **WHEN** the workflow runs and the pull request head and the workflow file are the same as for an earlier successful build
- **THEN** the run restores the cached binary for each platform and compiles nothing

#### Scenario: Pull request head moved

- **WHEN** the upstream pull request head differs from the one of the last build
- **THEN** the run compiles `bun-standalone` from the new head for each platform

#### Scenario: Workflow changed

- **WHEN** the content of `.github/workflows/bun-standalone.yaml` differs from the content of the last build
- **THEN** the run compiles again even though the pull request head is the same

#### Scenario: Head cannot be resolved

- **WHEN** the pull request head cannot be read
- **THEN** the run fails and compiles nothing

### Requirement: Caches

The workflow SHALL cache each platform's finished binary under the key `bun-standalone-<platform>-<head commit>-<workflow file hash>`, where the hash is computed from this repository. It SHALL cache downloaded dependencies and compiler output separately, restoring by key prefix, so that a recompile reuses them. A restored dependency cache SHALL NOT stand in for a finished binary. It SHALL give its callers the head commit and the workflow file hash, so a caller can restore the finished binary of a platform.

#### Scenario: Binary key

- **WHEN** the workflow is read
- **THEN** the binary cache key contains the platform, the resolved head commit, and a hash of the workflow file computed from this repository

#### Scenario: Recompile reuses dependencies

- **WHEN** the pull request head moved and an earlier dependency cache exists for the platform
- **THEN** the compile restores that dependency cache first

#### Scenario: Caller restores a binary

- **WHEN** a caller reads the head commit and the hash the workflow gives it
- **THEN** it can restore the binary of one platform under the key above without compiling

### Requirement: Output

Every run that succeeds SHALL attach, for each of macOS arm64, macOS x64, Linux x64 and Linux arm64, one archive `bun-standalone-<os>-<arch>.zip` holding the `bun-standalone` executable, whether it was compiled or restored. Before attaching, the run SHALL check that the executable reports a version, runs a script, and refuses `build`. The job summary SHALL name the pull request head commit.

#### Scenario: Archives attached

- **WHEN** the workflow succeeds
- **THEN** the run has the archives `bun-standalone-darwin-arm64.zip`, `bun-standalone-darwin-x64.zip`, `bun-standalone-linux-x64.zip` and `bun-standalone-linux-arm64.zip`

#### Scenario: Executable is not the full runtime

- **WHEN** the executable of a platform allows `build`
- **THEN** the run fails for that platform and attaches nothing for it

### Requirement: Run by CI on main only

The CI workflow SHALL have a job named `Bun standalone` that calls the workflow, and that job SHALL run only on `main`, or when the release workflow is dispatched by hand with its `bun-standalone` input set to `yes`; in every other case, including a push to another branch, it SHALL be skipped. The job SHALL give the release workflow the head commit and the workflow file hash. The workflow SHALL have only read access to the repository contents, SHALL NOT publish a release or any asset outside its own run, and SHALL NOT be called by any workflow other than the CI workflow. The release workflow's `bun-standalone` input SHALL default to `no`.

#### Scenario: Push to main

- **WHEN** the release workflow runs for a push to `main`
- **THEN** its CI call runs the `Bun standalone` job, which compiles nothing when the cached binaries match

#### Scenario: Feature branch

- **WHEN** the CI workflow runs for a push to a branch other than `main`
- **THEN** the `Bun standalone` job is skipped

#### Scenario: Dispatch from a branch

- **WHEN** a maintainer dispatches the release workflow from a branch other than `main` with `bun-standalone` set to `yes`
- **THEN** the `Bun standalone` job runs for that branch
- **AND** the dispatch stays a dry run unless it was started on `main`

#### Scenario: Permissions

- **WHEN** the workflow file is read
- **THEN** it grants `contents: read` and no write permission

#### Scenario: Callers

- **WHEN** the other workflows are read
- **THEN** only the CI workflow uses `bun-standalone.yaml`
