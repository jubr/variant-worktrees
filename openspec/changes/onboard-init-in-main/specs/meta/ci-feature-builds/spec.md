## REMOVED Requirements

### Requirement: Packaging proven on feature branches

**Reason**: The feature-branch run no longer builds or smoke-tests a `variant` executable. The macOS arm64 pre-release job is gone.
**Migration**: Both `.vsix` files stay on the feature-branch run. Release still builds every platform executable and smoke-tests the Linux x64 binary. See Extension packages on feature branches.

## ADDED Requirements

### Requirement: Extension packages on feature branches

The CI workflow SHALL, in the same run, package both extensions as `.vsix` files and attach them to the run as downloadable artifacts. It SHALL NOT compile a `variant` executable, SHALL NOT run one, and SHALL NOT attach one.

#### Scenario: Packages build

- **WHEN** the CI workflow succeeds
- **THEN** the run has artifacts containing the variant-worktrees `.vsix` and the chat-renamer `.vsix`
- **AND** the run has no `variant` executable

#### Scenario: Packaging failure fails the build

- **WHEN** a `.vsix` cannot be packaged
- **THEN** the CI workflow fails
