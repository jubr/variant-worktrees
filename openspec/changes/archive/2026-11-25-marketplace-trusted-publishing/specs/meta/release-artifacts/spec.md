## MODIFIED Requirements

### Requirement: Manual registry publication

A separate workflow SHALL publish the `.vsix` files of one chosen release to the Visual Studio Marketplace and to Open VSX. It SHALL start only by manual dispatch naming a release tag, or as the last job of the release workflow when that run created the release, SHALL run in the `marketplace` environment that the registry trusted publishing policies name, and SHALL publish the exact `.vsix` files attached to that release without rebuilding them. The workflow SHALL authenticate to both registries through trusted publishing, without a stored token: no `VSCE_PAT` and no `OVSX_PAT` secret. The OIDC token permission SHALL be granted to the publishing job only.

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

#### Scenario: No stored Marketplace token

- **WHEN** the workflow file is read
- **THEN** it references no `VSCE_PAT` secret

#### Scenario: Marketplace publication through trusted publishing

- **WHEN** the publishing job runs for the Visual Studio Marketplace
- **THEN** it publishes the `.vsix` file with an OIDC credential that the Marketplace exchanges for the workflow, environment and repository named in its trusted publishing policy
