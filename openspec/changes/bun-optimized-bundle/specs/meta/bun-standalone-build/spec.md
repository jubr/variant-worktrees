## Purpose

Build the slim Bun runtime from an upstream pull request on GitHub-hosted runners, only when that pull request or the build recipe changed, so the binary can be tried without a local build and without repeating a long compile.

## ADDED Requirements

### Requirement: Build only when the pull request head or the workflow changed

The repository SHALL have a workflow `.github/workflows/bun-standalone.yaml` that resolves the head commit of upstream Bun pull request 32262 and compiles the `bun-standalone` runtime from that commit. It SHALL compile for a platform only when no cached build exists for the pair of that head commit and the content hash of the workflow file. It SHALL run on a schedule, by manual dispatch, and on a push that changes the workflow file; it SHALL NOT run for pull requests of this repository. A run that finds a cached build SHALL NOT install a toolchain or compile. When the pull request head cannot be resolved, the run SHALL fail.

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

The workflow SHALL cache each platform's finished binary under a key that contains the platform, the pull request head commit, and the workflow file hash. It SHALL cache downloaded dependencies and compiler output separately, restoring by key prefix, so that a recompile reuses them. A restored dependency cache SHALL NOT stand in for a finished binary.

#### Scenario: Binary key

- **WHEN** the workflow is read
- **THEN** the binary cache key contains the platform, the resolved head commit, and a hash of the workflow file computed from this repository

#### Scenario: Recompile reuses dependencies

- **WHEN** the pull request head moved and an earlier dependency cache exists for the platform
- **THEN** the compile restores that dependency cache first

### Requirement: Output

Every run that succeeds SHALL attach, for each of macOS arm64, Linux x64 and Linux arm64, one archive `bun-standalone-<os>-<arch>.zip` holding the `bun-standalone` executable, whether it was compiled or restored. Before attaching, the run SHALL check that the executable reports a version, runs a script, and refuses `build`. The job summary SHALL name the pull request head commit.

#### Scenario: Archives attached

- **WHEN** the workflow succeeds
- **THEN** the run has the archives `bun-standalone-darwin-arm64.zip`, `bun-standalone-linux-x64.zip` and `bun-standalone-linux-arm64.zip`

#### Scenario: Executable is not the full runtime

- **WHEN** the executable of a platform allows `build`
- **THEN** the run fails for that platform and attaches nothing for it

### Requirement: Not part of the gate or the release

The workflow SHALL NOT be called by the CI or release workflows, SHALL NOT publish a release or any other asset outside its own run, and SHALL have only read access to the repository contents. No workflow SHALL set `VARIANT_BUN_RUNTIME`.

#### Scenario: Permissions

- **WHEN** the workflow file is read
- **THEN** it grants `contents: read` and no write permission

#### Scenario: Not called by others

- **WHEN** the other workflows are read
- **THEN** none of them uses `bun-standalone.yaml`
