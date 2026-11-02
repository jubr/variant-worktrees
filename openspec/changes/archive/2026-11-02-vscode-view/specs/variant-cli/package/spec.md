## ADDED Requirements

### Requirement: The UI server is part of the CLI

`variant ui` SHALL run from the `variant` command alone. The server and the built variants app SHALL ship inside the `variant-cli` npm package and inside every compiled single-file executable of a release; no other package, executable or file has to be installed next to them. The server SHALL NOT be a command, executable or published package of its own.

#### Scenario: Installed package

- **WHEN** only `variant-cli` is installed from the registry and `variant ui --detach` runs in a project
- **THEN** it prints the URL with the token and the page at that URL serves the app

#### Scenario: Compiled executable

- **WHEN** a compiled `variant` executable runs `variant ui --detach` away from the repository
- **THEN** it prints the URL with the token and the page at that URL serves the app

#### Scenario: No second executable

- **WHEN** the manifests of `variant-cli`, `variant-api` and the server package are read
- **THEN** `variant` is the only `bin` among them
