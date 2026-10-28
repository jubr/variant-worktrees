# meta/release-artifacts Specification

## Purpose

Define the artifacts a green `main` build releases and how they are handed to the Visual Studio Marketplace and Open VSX, so shipping a new version needs a version bump and a human approval, not a developer machine.

## Requirements

### Requirement: Lockstep release version

The release SHALL have one version, shared by the root package, `variant-api`, `variant-vscode`, and `chat-renamer`. A release run SHALL fail before building artifacts when those versions differ.

#### Scenario: Versions agree

- **WHEN** all four packages declare version `1.2.3`
- **THEN** the release version is `1.2.3` and the release tag is `v1.2.3`

#### Scenario: Versions differ

- **WHEN** any of the four packages declares a version different from the others
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

A release SHALL be a GitHub Release tagged `v<version>` at the built commit. It SHALL contain the variant-worktrees `.vsix`, the chat-renamer `.vsix`, one `variant` single-file executable per supported platform, and a SHA-256 checksum file covering every attached file. Supported platforms SHALL be Linux x64, Linux arm64, macOS x64, macOS arm64, Windows x64, and Windows arm64. Each executable SHALL bundle the Bun runtime and the CLI's dependencies, and SHALL NOT need Bun or Node.js installed.

#### Scenario: Assets present

- **WHEN** release `v1.2.3` is published
- **THEN** its assets include `variant-worktrees-1.2.3.vsix` and `chat-renamer-1.2.3.vsix`
- **AND** a `variant` executable for each of the six platforms, named with the version and platform
- **AND** a checksum file listing every asset

#### Scenario: Checksums verify

- **WHEN** a user downloads an asset and checks it against the checksum file
- **THEN** the checksum matches

### Requirement: No duplicate release

The release workflow SHALL NOT create or modify a release when the tag `v<version>` already exists.

#### Scenario: Version already released

- **WHEN** a green push to `main` does not change the version and `v<version>` already exists
- **THEN** no release is created and the run succeeds

#### Scenario: New version

- **WHEN** a green push to `main` carries a version whose tag does not exist
- **THEN** the tag and release are created

### Requirement: Manual registry publication

A separate workflow SHALL publish the `.vsix` files of one chosen release to the Visual Studio Marketplace and to Open VSX. It SHALL start only by manual dispatch naming a release tag, SHALL run in a protected environment that requires approval, and SHALL publish the exact `.vsix` files attached to that release without rebuilding them. Registry credentials SHALL come only from repository secrets.

#### Scenario: Not triggered automatically

- **WHEN** a release is created or a push lands on `main`
- **THEN** the publish workflow does not run

#### Scenario: Publish a release

- **WHEN** a maintainer dispatches the workflow with tag `v1.2.3` and approves the environment
- **THEN** both `.vsix` files from release `v1.2.3` are published to the Visual Studio Marketplace and to Open VSX

#### Scenario: Unknown tag

- **WHEN** the named tag has no release or lacks a `.vsix`
- **THEN** the workflow fails before contacting either registry

#### Scenario: One registry selected

- **WHEN** the maintainer selects only one registry
- **THEN** only that registry receives the `.vsix` files

#### Scenario: Release files survive repository checkout

- **WHEN** the approved publish run has downloaded the release `.vsix` files and checked out the repository
- **THEN** every downloaded `.vsix` file is still present when the first registry is contacted
- **AND** the run fails before contacting either registry if none is present
