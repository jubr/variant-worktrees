## MODIFIED Requirements

### Requirement: CLI reports the package version

The `variant` CLI SHALL report the `version` of the `variant-cli` package, not a fixed number. `variant --version` SHALL print the version token and a parenthetical on the first line. When standard output is a terminal, it SHALL then print a cursive ASCII drawing of the words `Variant-Worktrees`, then a blank line, then one details line. The drawing SHALL be the same text on every run and SHALL occupy more than one line. When standard output is a terminal and `NO_COLOR` is unset, the drawing SHALL be colored orange, each hyphen glyph in that drawing SHALL be the default terminal color via an ANSI reset with the orange color resumed after the glyph, and the first line and the details line SHALL NOT be colored. When standard output is a terminal and `NO_COLOR` is set, the drawing SHALL be those same glyphs with no ANSI color sequences. When standard output is not a terminal, the drawing and that blank line SHALL be omitted, and the details line SHALL be the second line.

On a build from the `main` branch, and when the commit id cannot be determined, the parentheses SHALL contain the UTC date as `YYYY-MM-DD`. On a build from any other branch the parentheses SHALL contain the UTC time as `YYYY-MM-DD HH:MM:SS`. The details line SHALL be the runtime platform, a comma and a space, then the GitHub repository URL `https://github.com/jubr/variant-worktrees`. The details line SHALL NOT contain a date or a commit hash. The platform SHALL be `macos` when the runtime is Darwin, `linux` when it is Linux, and `windows` when it is Windows, then a hyphen, then the runtime CPU architecture, as in `macos-arm64`. For a run from source that parenthetical SHALL use the UTC clock of that run. For the built `dist/` and for a compiled single-file executable it SHALL use the UTC clock of that build, including when the artifact runs outside that checkout.

On a build from the `main` branch the version token SHALL be the package version. On a build from any other branch the version token SHALL be the package version, a hyphen, and `{slug}-{n}-{hash4}`. `slug` SHALL be that branch with a variant branch prefix removed (`feat/`, `fix/`, `feature/`) and with every other character that is not a letter or digit turned into a single hyphen. `n` SHALL be the number of commits after the nearest tag reachable from that commit, or the number of commits in the history when no tag is reachable. `{hash4}` SHALL be the first four characters of the full lowercase hexadecimal commit id and SHALL NOT be lengthened to stay unique. A branch that is not `main` and has `n` of zero SHALL still use that suffix. When that commit id cannot be determined, the version token SHALL be the package version with no suffix, and the details line SHALL still contain the platform and the URL.

The first line of `variant --help` SHALL be `variant v` followed by the package version and SHALL NOT contain the banner, the platform, the date, the hash, or the URL. This SHALL hold when the CLI runs from source, from the built `dist/`, and from the compiled single-file executable.

#### Scenario: Version flag

- **WHEN** a user runs `variant --version` from source on a branch other than `main` whose commit id is known, and standard output is a terminal
- **THEN** the first line is the `version` in the `variant-cli` `package.json`, a hyphen, `{slug}-{n}-{hash4}`, and parentheses containing the UTC time of that run as `YYYY-MM-DD HH:MM:SS`
- **AND** the following lines are the cursive drawing of `Variant-Worktrees`
- **AND** a blank line follows that drawing
- **AND** the last line is the runtime platform, a comma, and `https://github.com/jubr/variant-worktrees`
- **AND** the last line contains no date and no commit hash

#### Scenario: Version flag from a built artifact

- **WHEN** `variant --version` runs from the built `dist/` or from a compiled single-file executable, outside the checkout it was built from
- **THEN** standard output uses the parenthetical captured when that artifact was built, and the `{slug}-{n}-{hash4}` captured for that build when the branch was not `main`

#### Scenario: Version flag from main

- **WHEN** a user runs `variant --version` from a build of the `main` branch whose commit id is known
- **THEN** the first line is the `version` in the `variant-cli` `package.json`, parentheses containing the UTC date as `YYYY-MM-DD`, and no hyphenated suffix

#### Scenario: Version flag without a commit

- **WHEN** a user runs `variant --version` and the commit id cannot be determined
- **THEN** the first line is the `version` in the `variant-cli` `package.json`, parentheses containing the UTC date as `YYYY-MM-DD`, and no hyphenated suffix
- **AND** the last line is the runtime platform, a comma, and `https://github.com/jubr/variant-worktrees`, with no date and no commit hash

#### Scenario: Colored banner

- **WHEN** a user runs `variant --version` with standard output on a terminal and `NO_COLOR` unset
- **THEN** the drawing is colored orange, the hyphen glyphs in the drawing are the default terminal color, and the first line and the last line are not

#### Scenario: Plain banner

- **WHEN** a user runs `variant --version` with standard output on a terminal and `NO_COLOR` set
- **THEN** the drawing is present, the drawing has no ANSI color sequences, and the last line is the platform and the URL

#### Scenario: Banner omitted off a terminal

- **WHEN** a user runs `variant --version` with standard output not on a terminal
- **THEN** the cursive drawing is absent
- **AND** the second line is the runtime platform, a comma, and `https://github.com/jubr/variant-worktrees`
- **AND** there is no blank line between the first line and that details line

#### Scenario: Help header

- **WHEN** a user runs `variant --help`
- **THEN** the first line is `variant v` followed by the `version` in the `variant-cli` `package.json`
- **AND** that line does not contain the date, the hash, or the repository URL
