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

The CI workflow SHALL, in the same run, package both extensions as `.vsix` files and attach them to the run as downloadable artifacts. It SHALL NOT attach a `variant` executable. Its one compile of the `variant` executable is the one that "Slim runtime available for the pinned Bun" requires, and that executable is run only for the smoke test.

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

Every GitHub Action that the workflows under `.github/workflows/` use SHALL be pinned either to a major version, or to the full commit of a release of that major, that runs on the Node.js 24 runtime (or is a composite action), so a run reports no annotation that an action targets a deprecated Node.js runtime. The actions are `actions/checkout`, `actions/upload-artifact`, `actions/download-artifact`, `jdx/mise-action`, `jdx/packslip`, `oven-sh/setup-bun`, `actions/upload-pages-artifact`, `actions/deploy-pages` and `azure/login` (when enabled). Outside `.github/workflows/packslip.yaml`, `actions/upload-artifact` and `actions/download-artifact` SHALL stay pinned to a major version.

#### Scenario: Run without Node deprecation annotations

- **WHEN** the CI workflow runs on a feature branch
- **THEN** its annotations hold no warning that an action targets Node.js 20

#### Scenario: Other workflows keep major pins

- **WHEN** a workflow other than `.github/workflows/packslip.yaml` is read
- **THEN** `actions/upload-artifact` and `actions/download-artifact` are pinned to a major version

### Requirement: A hung gate fails

Every job of the CI workflow SHALL have a time limit well above a normal run, so that a hung test run fails the check instead of keeping it pending.

#### Scenario: Hung test run

- **WHEN** a gate step produces no result within the time limit
- **THEN** the job is cancelled and the check fails

### Requirement: Slim runtime available for the pinned Bun

The job of the CI workflow that runs the library and the CLI SHALL compile the `variant` executable for `bun-linux-x64` with `task package:cli` and SHALL run `variant --version` from it. The job SHALL fail when the details line does not name the slim runtime of the Bun version `mise.toml` pins (`bun-slim-v<X.Y.Z>-<N>`), so that a branch learns before a release does that `github.com/jubr/bun-slim` has no build of that version. The job SHALL NOT attach the executable to the run.

#### Scenario: Slim runtime published for the pinned version

- **WHEN** `mise.toml` pins Bun `1.4.5` and `github.com/jubr/bun-slim` has a release `bun-slim-v1.4.5-<N>`
- **THEN** the compiled executable prints a details line with `bun-slim-v1.4.5-<N>` and the job passes

#### Scenario: No slim runtime for the pinned version

- **WHEN** `mise.toml` pins a Bun version for which `github.com/jubr/bun-slim` has no release
- **THEN** the compile warns and embeds the default runtime, `variant --version` prints `bun-v<version>`, and the job fails

### Requirement: Branch builds report the slim runtime and executable sizes

After the compile and smoke test of `variant` for linux-x64, the CI workflow SHALL write a Markdown table to the step summary of that job. The table SHALL name the `bun-slim` release the executable embeds (`bun-slim-vX.Y.Z-N`), and give, in KB (1 KB = 1024 bytes), the size of that slim runtime and the size of the compiled `variant`. The report SHALL NOT fail the job: when the release or a size cannot be determined, the table SHALL show `–` for it. The report SHALL NOT download anything.

#### Scenario: Table on a green run

- **WHEN** the CI workflow compiles `variant` for linux-x64 with the slim runtime `bun-slim-v1.4.5-1`
- **THEN** the step summary has a table with `bun-slim-v1.4.5-1`, the size of the slim runtime in KB and the size of `variant` in KB

#### Scenario: Release unknown

- **WHEN** the slim runtime is not in the cache directory of the job
- **THEN** the table shows `–` for the release and the runtime size, and still gives the size of `variant`
- **AND** the job does not fail because of the report
