## MODIFIED Requirements

### Requirement: Runs on Node and Bun

`variant` SHALL run under Node.js 22.13 or newer and under Bun, and the package SHALL declare `engines.node` as `>=22.13.0`. The compiled single-file executables of a release SHALL be built from this package and keep the names `variant-<version>-<os>-<arch>[.exe]`. `variant --version` under Node and under Bun SHALL print the same output for the same kind of standard output. That output SHALL be the version token and the captured parenthetical (a UTC date on `main`, a UTC date and time on any other branch), then, only when standard output is a terminal, the cursive `Variant-Worktrees` drawing and a blank line, then the runtime platform and the repository URL defined for the CLI, separated by a comma. That last line SHALL NOT contain a date or a commit hash. A build from a branch other than `main` SHALL use the same `{version}-{slug}-{n}-{hash4}` token under both. When standard output is not a terminal, both runtimes SHALL omit the drawing and the blank line.

#### Scenario: Version under Node

- **WHEN** `variant --version` runs under Node from the built `dist/` with standard output not on a terminal
- **THEN** it prints the version token and the parenthetical captured for that build, no cursive drawing, and a last line with the runtime platform and `https://github.com/jubr/variant-worktrees`, and no date or commit hash on that line

#### Scenario: Version under Bun

- **WHEN** `variant --version` runs under Bun from the same `dist/` with the same kind of standard output
- **THEN** it prints the same output as under Node

#### Scenario: Executable names

- **WHEN** the release executables are built for version `1.2.3` on macOS arm64
- **THEN** the file is named `variant-1.2.3-darwin-arm64`
