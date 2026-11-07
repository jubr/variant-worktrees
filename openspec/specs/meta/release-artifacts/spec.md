# meta/release-artifacts Specification

## Purpose

Define the artifacts a green `main` build releases and how they are handed to the Visual Studio Marketplace and Open VSX, so shipping a new version needs a version bump and a human approval, not a developer machine.

## Requirements

### Requirement: Lockstep release version

The release SHALL have one version, shared by the root package, `variant-api`, `variant-cli`, `variant-vscode`, and `chat-renamer`. A release run SHALL fail before building artifacts when those versions differ.

#### Scenario: Versions agree

- **WHEN** all five packages declare version `1.2.3`
- **THEN** the release version is `1.2.3` and the release tag is `v1.2.3`

#### Scenario: Versions differ

- **WHEN** any of the five packages declares a version different from the others
- **THEN** the release run fails and names the packages and their versions

### Requirement: Release only after a green main build

The release workflow SHALL run for pushes to `main` and SHALL build and publish release artifacts only when the full CI workflow succeeded for that commit.

#### Scenario: CI red

- **WHEN** the CI workflow fails for a push to `main`
- **THEN** no release artifacts are published

#### Scenario: CI green

- **WHEN** the CI workflow succeeds for a push to `main`
- **THEN** release artifacts are built and published

### Requirement: Release contents

A release SHALL be a GitHub Release tagged `v<version>` at the built commit. It SHALL contain the variant-worktrees `.vsix`, the chat-renamer `.vsix`, one `variant` single-file executable per supported platform, and a SHA-256 checksum file covering every built asset. The checksum file SHALL NOT list `packslip.sigstore.json`. Supported platforms SHALL be Linux x64, Linux arm64, macOS x64, macOS arm64, Windows x64, and Windows arm64. Each executable SHALL bundle the Bun runtime and the CLI's dependencies, and SHALL NOT need Bun or Node.js installed.

#### Scenario: Assets present

- **WHEN** release `v1.2.3` is published
- **THEN** its assets include `variant-worktrees-1.2.3.vsix` and `chat-renamer-1.2.3.vsix`
- **AND** a `variant` executable for each of the six platforms, named with the version and platform
- **AND** a checksum file listing those built assets and not `packslip.sigstore.json`

#### Scenario: Checksums verify

- **WHEN** a user downloads a built asset and checks it against the checksum file
- **THEN** the checksum matches

### Requirement: Signed release bundle

The repository SHALL ship one reusable workflow, `.github/workflows/packslip.yaml`, that signs the six `variant` executables of one published GitHub Release and uploads `packslip.sigstore.json` to that release. The release workflow SHALL call it, passing the tag `v<version>`, only after that run created the release. A dry run SHALL NOT call it. A run that finds `v<version>` already released SHALL NOT call it. A maintainer SHALL be able to run the same workflow by hand for one tag. The job that runs the signing action SHALL have `contents: read`, SHALL NOT have `contents: write`, SHALL have `id-token: write` and `attestations: write`, and SHALL NOT upload the bundle. That job SHALL download exactly the six `variant` executables and no other release asset. The following job SHALL have `contents: write`, SHALL NOT have `id-token: write`, and SHALL upload only `packslip.sigstore.json`. The bundle SHALL name the command `variant` on each of the six platforms and SHALL link build provenance for each executable. `jdx/packslip`, `actions/upload-artifact`, and `actions/download-artifact` in this workflow SHALL be pinned to full commits.

#### Scenario: New release is signed

- **WHEN** the release workflow creates release `v1.2.3`
- **THEN** that release has an asset `packslip.sigstore.json`
- **AND** the job that ran the signing action could not change the release

#### Scenario: Dry run

- **WHEN** a maintainer dispatches the release workflow as a dry run
- **THEN** the signing workflow is not called

#### Scenario: Already released

- **WHEN** the release workflow finds `v<version>` already released
- **THEN** it does not call the signing workflow

#### Scenario: Feature branch

- **WHEN** the CI workflow runs on a feature branch
- **THEN** it does not call the signing workflow

#### Scenario: Sign an existing tag by hand

- **WHEN** a maintainer dispatches the signing workflow with tag `v1.2.3` and that release has all six `variant` executables
- **THEN** `packslip.sigstore.json` is uploaded to that release
- **AND** the `.vsix` files, executables, and checksum file on that release are left unchanged

#### Scenario: Release not signable

- **WHEN** the named tag has no release, or the release lacks any of the six `variant` executables
- **THEN** the signing workflow fails and uploads no bundle

#### Scenario: Signing fails after the release exists

- **WHEN** the release workflow creates the release and signing then fails
- **THEN** the release workflow fails
- **AND** a later run that finds the tag already released does not sign it

#### Scenario: Workflow file

- **WHEN** `.github/workflows/packslip.yaml` is read
- **THEN** the job that runs the signing action sets `contents: read` and does not upload
- **AND** only the following job sets `contents: write`
- **AND** `jdx/packslip`, `actions/upload-artifact`, and `actions/download-artifact` are pinned to full commits

### Requirement: No duplicate release

The release workflow SHALL NOT create or modify a release when the tag `v<version>` already exists.

#### Scenario: Version already released

- **WHEN** a green push to `main` does not change the version and `v<version>` already exists
- **THEN** no release is created and the run succeeds

#### Scenario: New version

- **WHEN** a green push to `main` carries a version whose tag does not exist
- **THEN** the tag and release are created

### Requirement: Manual registry publication

A separate workflow SHALL publish the `.vsix` files of one chosen release to the Visual Studio Marketplace and to Open VSX. It SHALL start only by manual dispatch naming a release tag, or as the last job of the release workflow when that run created the release, SHALL run in the `marketplace` environment that holds the registry credentials, and SHALL publish the exact `.vsix` files attached to that release without rebuilding them. The workflow SHALL authenticate to Open VSX through trusted publishing, without a stored token, and to the Visual Studio Marketplace with the repository secret `VSCE_PAT` until the Marketplace supports trusted publishing. The OIDC token permission SHALL be granted to the publishing job only.

#### Scenario: Not triggered by itself

- **WHEN** a release is created outside the release workflow or a push lands on `main`
- **THEN** the publish workflow does not run on its own

#### Scenario: Called after a new release

- **WHEN** the release workflow creates release `v<version>`
- **THEN** it runs the publish workflow for that tag as its last job

#### Scenario: Already released version

- **WHEN** the release workflow finds `v<version>` already released
- **THEN** the publish workflow is not run

#### Scenario: Publish a release

- **WHEN** a maintainer dispatches the workflow with tag `v1.2.3`
- **THEN** both `.vsix` files from release `v1.2.3` are published to the Visual Studio Marketplace and to Open VSX

#### Scenario: Unknown tag

- **WHEN** the named tag has no release or lacks a `.vsix`
- **THEN** the workflow fails before contacting either registry

#### Scenario: One registry selected

- **WHEN** the maintainer selects only one registry
- **THEN** only that registry receives the `.vsix` files

#### Scenario: Release files survive repository checkout

- **WHEN** the publish run has downloaded the release `.vsix` files and checked out the repository
- **THEN** every downloaded `.vsix` file is still present when the first registry is contacted
- **AND** the run fails before contacting either registry if none is present

#### Scenario: No stored Open VSX token

- **WHEN** the workflow file is read
- **THEN** it references no `OVSX_PAT` secret, and only the publishing job has `id-token: write`

### Requirement: Release preparation task

`task release:prepare` SHALL prepare a patch release from `main` in one command: bump the lockstep version, write release notes into the changelogs, commit them on the branch `release/v<version>`, push that branch, and open a GitHub pull request into `main`. It SHALL NOT create a tag, merge the pull request, or publish anything. It SHALL refuse to start, before changing any file, unless the checkout is on `main`, has no uncommitted changes to tracked files, is not behind `origin/main`, the release packages share one version, and `gh` is authenticated.

#### Scenario: Prepare a release

- **WHEN** a maintainer runs `task release:prepare` on a clean, current `main` whose release version is `1.2.3`
- **THEN** the branch `release/v1.2.4` exists on `origin` with one commit `chore(release): v1.2.4` that bumps every release package to `1.2.4` and updates the changelogs
- **AND** a pull request from that branch into `main` is open
- **AND** no tag `v1.2.4` exists

#### Scenario: Not on main

- **WHEN** the checkout is on a branch other than `main`
- **THEN** the task fails naming the branch and no file is changed

#### Scenario: Uncommitted changes

- **WHEN** a tracked file has uncommitted changes
- **THEN** the task fails and no file is changed

#### Scenario: Behind origin

- **WHEN** `main` is behind `origin/main`
- **THEN** the task fails and no file is changed

#### Scenario: Versions differ

- **WHEN** the release packages do not share one version
- **THEN** the task fails with the version disagreement and no file is changed

### Requirement: Changelog release notes

For the new version, release preparation SHALL add to every `CHANGELOG*.md` of the repository root and of each package a section headed `## [<version>] - <YYYY-MM-DD>`. That section SHALL hold the former contents of the `Unreleased` section, if the changelog has one, followed by a `### Release notes` subsection with the notes GitHub generates for the pull requests merged since the previous release tag. The `Unreleased` section SHALL be removed: a changelog SHALL NOT contain an `Unreleased` heading after release preparation, bracketed or not. The new section SHALL take the place of the `Unreleased` section, or directly precede the newest version section when there was none. A changelog without an `Unreleased` section SHALL NOT fail release preparation. Text outside the `Unreleased` section SHALL NOT change. A contributor who records the next change SHALL add a `## Unreleased` heading again when none exists.

#### Scenario: Unreleased is promoted

- **WHEN** `CHANGELOG.md` has bullets under `## Unreleased` and the release version is `1.2.4`
- **THEN** those bullets appear under `## [1.2.4] - <date>`, followed by `### Release notes`
- **AND** the changelog has no `Unreleased` heading

#### Scenario: Bracketed heading removed

- **WHEN** a package changelog has `## [Unreleased]` above its version sections
- **THEN** the released changelog has no `Unreleased` heading, bracketed or not

#### Scenario: Nothing under Unreleased

- **WHEN** a changelog has an empty `Unreleased` section
- **THEN** its new version section holds only the `### Release notes` subsection
- **AND** the changelog has no `Unreleased` heading

#### Scenario: No Unreleased section

- **WHEN** a changelog has no `Unreleased` section, because the previous release removed it and nothing was recorded since
- **THEN** release preparation succeeds
- **AND** the new version section holds only the `### Release notes` subsection and sits directly above the previous version section

#### Scenario: Notes come from GitHub

- **WHEN** GitHub generates notes between the previous release tag and the new version
- **THEN** each pull request line of those notes appears under `### Release notes` in every changelog

#### Scenario: Version section already present

- **WHEN** a changelog already has a section for the new version
- **THEN** the task fails and writes nothing

### Requirement: Release pull request

The release pull request SHALL be titled `chore(release): v<version>`, SHALL target `main`, and SHALL carry the generated release notes as its body. A failure after the files changed SHALL NOT roll them back, and `task release:pr` SHALL be re-runnable to retry the commit, push, and pull request.

#### Scenario: Pull request content

- **WHEN** the pull request for `v1.2.4` is opened
- **THEN** its title is `chore(release): v1.2.4`, its base is `main`, and its body is the generated release notes

#### Scenario: Push fails

- **WHEN** pushing the release branch fails
- **THEN** the task exits non-zero and the version bump and changelog edits remain in the checkout, committed on `release/v<version>`
- **AND** running `task release:pr` again pushes the branch and opens the pull request
