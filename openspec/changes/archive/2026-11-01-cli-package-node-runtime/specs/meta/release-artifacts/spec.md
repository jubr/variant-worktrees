## MODIFIED Requirements

### Requirement: Lockstep release version

The release SHALL have one version, shared by the root package, `variant-api`, `variant-cli`, `variant-vscode`, and `chat-renamer`. A release run SHALL fail before building artifacts when those versions differ.

#### Scenario: Versions agree

- **WHEN** all five packages declare version `1.2.3`
- **THEN** the release version is `1.2.3` and the release tag is `v1.2.3`

#### Scenario: Versions differ

- **WHEN** any of the five packages declares a version different from the others
- **THEN** the release run fails and names the packages and their versions
