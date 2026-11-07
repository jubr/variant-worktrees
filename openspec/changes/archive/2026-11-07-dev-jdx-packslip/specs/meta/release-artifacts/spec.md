## MODIFIED Requirements

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

## ADDED Requirements

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
