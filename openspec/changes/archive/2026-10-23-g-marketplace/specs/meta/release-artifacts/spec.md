## MODIFIED Requirements

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
