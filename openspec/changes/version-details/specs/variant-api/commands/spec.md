## MODIFIED Requirements

### Requirement: CLI reports the package version

The `variant` CLI SHALL report the `version` of the `variant-cli` package, not a fixed number. `variant --version` SHALL print a cursive ASCII drawing of the words `variant-worktrees`, then one version line. The drawing SHALL be the same text on every run and SHALL occupy more than one line. When standard output is a terminal and `NO_COLOR` is unset, the drawing SHALL be colored orange and the version line SHALL NOT be colored. Otherwise the drawing SHALL be those same glyphs with no ANSI color sequences. The version line SHALL be the last line.

The version line SHALL be the version token, a space, the runtime platform, a space, then parentheses containing the build date and the GitHub repository URL `https://github.com/jubr/variant-worktrees`, separated by a single space. The parentheses SHALL NOT contain a commit hash. The platform SHALL be `macos` when the runtime is Darwin, `linux` when it is Linux, and `windows` when it is Windows, then a hyphen, then the runtime CPU architecture, as in `macos-arm64`. The build date SHALL be a UTC calendar date in the form `YYYY-MM-DD`. For a run from source it SHALL be the UTC date of that run. For the built `dist/` and for a compiled single-file executable it SHALL be the UTC date of that build, including when the artifact runs outside that checkout.

On a build from the `main` branch the version token SHALL be the package version. On a build from any other branch the version token SHALL be the package version, a hyphen, and `{slug}-{n}-{hash4}`. `slug` SHALL be that branch with a variant branch prefix removed (`feat/`, `fix/`, `feature/`) and with every other character that is not a letter or digit turned into a single hyphen. `n` SHALL be the number of commits after the nearest tag reachable from that commit, or the number of commits in the history when no tag is reachable. `{hash4}` SHALL be the first four characters of the full lowercase hexadecimal commit id and SHALL NOT be lengthened to stay unique. A branch that is not `main` and has `n` of zero SHALL still use that suffix. When that commit id cannot be determined, the version token SHALL be the package version with no suffix, and the version line SHALL still contain the parentheses with the date and the URL.

The first line of `variant --help` SHALL be `variant v` followed by the package version and SHALL NOT contain the banner, the platform, the date, the hash, or the URL. This SHALL hold when the CLI runs from source, from the built `dist/`, and from the compiled single-file executable.

#### Scenario: Version flag

- **WHEN** a user runs `variant --version` from source on a branch other than `main` whose commit id is known
- **THEN** the last line is the `version` in the `variant-cli` `package.json`, a hyphen, `{slug}-{n}-{hash4}`, a space, the runtime platform, a space, and parentheses containing the UTC date of that run and `https://github.com/jubr/variant-worktrees`, separated by a single space
- **AND** that line contains no other commit hash
- **AND** the lines above it are the cursive drawing of `variant-worktrees`

#### Scenario: Version flag from a built artifact

- **WHEN** `variant --version` runs from the built `dist/` or from a compiled single-file executable, outside the checkout it was built from
- **THEN** standard output uses the UTC date captured when that artifact was built, and the `{slug}-{n}-{hash4}` captured for that build when the branch was not `main`

#### Scenario: Version flag from main

- **WHEN** a user runs `variant --version` from a build of the `main` branch whose commit id is known
- **THEN** the last line begins with the `version` in the `variant-cli` `package.json` and a space, with no hyphenated suffix before the platform

#### Scenario: Version flag without a commit

- **WHEN** a user runs `variant --version` and the commit id cannot be determined
- **THEN** the last line is the `version` in the `variant-cli` `package.json`, a space, the runtime platform, and parentheses containing the date and `https://github.com/jubr/variant-worktrees`, with no hyphenated suffix and no commit hash

#### Scenario: Colored banner

- **WHEN** a user runs `variant --version` with standard output on a terminal and `NO_COLOR` unset
- **THEN** the drawing is colored orange and the version line is not

#### Scenario: Plain banner

- **WHEN** a user runs `variant --version` with standard output not on a terminal, or with `NO_COLOR` set
- **THEN** the drawing has no ANSI color sequences and the last line is the version line

#### Scenario: Help header

- **WHEN** a user runs `variant --help`
- **THEN** the first line is `variant v` followed by the `version` in the `variant-cli` `package.json`
- **AND** that line does not contain the date, the hash, or the repository URL
