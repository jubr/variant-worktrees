# variant-cli/package Specification

## Purpose

The `variant-cli` package provides the `variant` command, apart from the library, so installing the library never installs a command line and the command line can grow without the library depending on it.

## Requirements

### Requirement: The package provides the variant command

The `variant-cli` package SHALL provide the executable `variant`. The `variant-api` package SHALL NOT provide an executable and SHALL NOT depend on the command-line parser. `variant` SHALL call `variant-api` in-process and SHALL keep the commands, flags, output and exit codes it had when it shipped in `variant-api`. The library SHALL return the same results to every caller; text, JSON and YAML rendering SHALL happen only in the CLI.

#### Scenario: Global install

- **WHEN** `variant-cli` is installed globally
- **THEN** `variant list` runs and prints what `variant list` printed before the move

#### Scenario: Library alone installs no command

- **WHEN** only `variant-api` is installed
- **THEN** no `variant` executable is provided

#### Scenario: Library results unchanged

- **WHEN** `client.list()` runs
- **THEN** it returns the same records as before the move, without any rendered text

#### Scenario: Library has no parser dependency

- **WHEN** the `variant-api` package manifest is read
- **THEN** it does not list the command-line parser as a dependency

### Requirement: Runs on Node and Bun

`variant` SHALL run under Node.js 22.13 or newer and under Bun, and the package SHALL declare `engines.node` as `>=22.13.0`. The compiled single-file executables of a release SHALL be built from this package and keep the names `variant-<version>-<os>-<arch>[.exe]`.

#### Scenario: Version under Node

- **WHEN** `variant --version` runs under Node
- **THEN** it prints the version alone

#### Scenario: Version under Bun

- **WHEN** `variant --version` runs under Bun
- **THEN** it prints the same version

#### Scenario: Executable names

- **WHEN** the release executables are built for version `1.2.3` on macOS arm64
- **THEN** the file is named `variant-1.2.3-darwin-arm64`

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
