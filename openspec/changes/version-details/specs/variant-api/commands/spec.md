## MODIFIED Requirements

### Requirement: CLI reports the package version

The `variant` CLI SHALL report the `version` of the `variant-cli` package, not a fixed number. `variant --version` SHALL print the version token and the build time in parentheses on the first line, then a cursive ASCII drawing of the words `Variant-Worktrees`, then a blank line, then one details line. The drawing SHALL be the same text on every run and SHALL occupy more than one line. When standard output is a terminal and `NO_COLOR` is unset, the drawing SHALL be colored orange and the first line and the details line SHALL NOT be colored. Otherwise the drawing SHALL be those same glyphs with no ANSI color sequences.

The first line SHALL end with parentheses containing the build time as UTC `YYYY-MM-DD HH:MM:SS`. The details line SHALL be the runtime platform, a comma and a space, then the GitHub repository URL `https://github.com/jubr/variant-worktrees`. The details line SHALL NOT contain a date or a commit hash. The platform SHALL be `macos` when the runtime is Darwin, `linux` when it is Linux, and `windows` when it is Windows, then a hyphen, then the runtime CPU architecture, as in `macos-arm64`. For a run from source the build time SHALL be the UTC time of that run. For the built `dist/` and for a compiled single-file executable it SHALL be the UTC time of that build, including when the artifact runs outside that checkout.

On a build from the `main` branch the version token SHALL be the package version. On a build from any other branch the version token SHALL be the package version, a hyphen, and `{slug}-{n}-{hash4}`. `slug` SHALL be that branch with a variant branch prefix removed (`feat/`, `fix/`, `feature/`) and with every other character that is not a letter or digit turned into a single hyphen. `n` SHALL be the number of commits after the nearest tag reachable from that commit, or the number of commits in the history when no tag is reachable. `{hash4}` SHALL be the first four characters of the full lowercase hexadecimal commit id and SHALL NOT be lengthened to stay unique. A branch that is not `main` and has `n` of zero SHALL still use that suffix. When that commit id cannot be determined, the version token SHALL be the package version with no suffix, and the details line SHALL still contain the platform and the URL.

The first line of `variant --help` SHALL be `variant v` followed by the package version and SHALL NOT contain the banner, the platform, the date, the hash, or the URL. This SHALL hold when the CLI runs from source, from the built `dist/`, and from the compiled single-file executable.

#### Scenario: Version flag

- **WHEN** a user runs `variant --version` from source on a branch other than `main` whose commit id is known
- **THEN** the first line is the `version` in the `variant-cli` `package.json`, a hyphen, `{slug}-{n}-{hash4}`, and parentheses containing the UTC time of that run as `YYYY-MM-DD HH:MM:SS`
- **AND** the following lines are the cursive drawing of `Variant-Worktrees`
- **AND** a blank line follows that drawing
- **AND** the last line is the runtime platform, a comma, and `https://github.com/jubr/variant-worktrees`
- **AND** the last line contains no date and no commit hash

#### Scenario: Version flag from a built artifact

- **WHEN** `variant --version` runs from the built `dist/` or from a compiled single-file executable, outside the checkout it was built from
- **THEN** standard output uses the UTC time captured when that artifact was built, and the `{slug}-{n}-{hash4}` captured for that build when the branch was not `main`

#### Scenario: Version flag from main

- **WHEN** a user runs `variant --version` from a build of the `main` branch whose commit id is known
- **THEN** the first line is the `version` in the `variant-cli` `package.json`, parentheses containing the build time, and no hyphenated suffix

#### Scenario: Version flag without a commit

- **WHEN** a user runs `variant --version` and the commit id cannot be determined
- **THEN** the first line is the `version` in the `variant-cli` `package.json`, parentheses containing the build time, and no hyphenated suffix
- **AND** the last line is the runtime platform, a comma, and `https://github.com/jubr/variant-worktrees`, with no date and no commit hash

#### Scenario: Colored banner

- **WHEN** a user runs `variant --version` with standard output on a terminal and `NO_COLOR` unset
- **THEN** the drawing is colored orange and the first line and the last line are not

#### Scenario: Plain banner

- **WHEN** a user runs `variant --version` with standard output not on a terminal, or with `NO_COLOR` set
- **THEN** the drawing has no ANSI color sequences and the last line is the platform and the URL

#### Scenario: Help header

- **WHEN** a user runs `variant --help`
- **THEN** the first line is `variant v` followed by the `version` in the `variant-cli` `package.json`
- **AND** that line does not contain the date, the hash, or the repository URL
