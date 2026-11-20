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

### Requirement: Smaller runtime through source patches

When it compiles, the workflow SHALL patch the checked-out upstream sources before building, using `sed` in a single step and without a fork of Bun. The patches SHALL build with the `MinSizeRel` build type (C++ at `-Oz`, Rust at `opt-level=z`), and SHALL replace `Bun.Image` and `bun:ffi` with throwing stubs so that libjpeg-turbo, libspng, libwebp and TinyCC stay out of the executable. For every file it patches or adds, the step SHALL print the unified diff of the file before and after. When a patch changes nothing, the step SHALL fail. Because the patches live in the workflow file, editing them SHALL change the workflow hash and so start a new compile. The executable check SHALL also verify that `Bun.Image` is undefined and that `bun:ffi` `dlopen` is refused.

#### Scenario: Patches shown

- **WHEN** the workflow compiles
- **THEN** the log of the patch step holds a unified diff, before and after, for every patched and every added file

#### Scenario: Upstream moved the patched lines

- **WHEN** a sed patch finds nothing to change in the checked-out sources
- **THEN** the patch step fails naming the file and nothing is compiled

#### Scenario: Patch edited

- **WHEN** a patch in the workflow file is edited
- **THEN** the workflow file hash differs and each platform compiles again

#### Scenario: Removed features

- **WHEN** the compiled executable is checked
- **THEN** `Bun.Image` is undefined and `bun:ffi` `dlopen` throws that it is not available
