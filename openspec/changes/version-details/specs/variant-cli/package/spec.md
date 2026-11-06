## MODIFIED Requirements

### Requirement: Runs on Node and Bun

`variant` SHALL run under Node.js 22.13 or newer and under Bun, and the package SHALL declare `engines.node` as `>=22.13.0`. The compiled single-file executables of a release SHALL be built from this package and keep the names `variant-<version>-<os>-<arch>[.exe]`. `variant --version` under Node and under Bun SHALL print the same output: the version token, then the cursive `Variant-Worktrees` drawing, a blank line, then the runtime platform, the build date, and the repository URL defined for the CLI, separated by commas. That last line SHALL NOT contain a commit hash. A build from a branch other than `main` SHALL use the same `{version}-{slug}-{n}-{hash4}` token under both.

#### Scenario: Version under Node

- **WHEN** `variant --version` runs under Node from the built `dist/`
- **THEN** it prints the version token, the drawing, and a last line with the runtime platform, the build date, and `https://github.com/jubr/variant-worktrees` captured for that build, and no commit hash on that line

#### Scenario: Version under Bun

- **WHEN** `variant --version` runs under Bun from the same `dist/`
- **THEN** it prints the same line as under Node

#### Scenario: Executable names

- **WHEN** the release executables are built for version `1.2.3` on macOS arm64
- **THEN** the file is named `variant-1.2.3-darwin-arm64`
