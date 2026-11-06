## MODIFIED Requirements

### Requirement: CLI reports the package version

The `variant` CLI SHALL report the `version` of the `variant-cli` package, not a fixed number. `variant --version` SHALL print one line and nothing else: that version, a space, then parentheses containing three space-separated fields in this order: the build date, the git commit hash, and the GitHub repository URL `https://github.com/jubr/variant-worktrees`. The build date SHALL be a UTC calendar date in the form `YYYY-MM-DD`. For a run from source it SHALL be the UTC date of that run, and the hash SHALL be taken from the checkout that contains the CLI. For the built `dist/` and for a compiled single-file executable it SHALL be the UTC date of that build, and the hash SHALL be the commit the artifact was built from, including when the artifact runs outside that checkout. The hash SHALL be the first eight characters of the full lowercase hexadecimal commit id. When that commit id cannot be determined, `variant --version` SHALL print the version alone and SHALL NOT print parentheses. The first line of `variant --help` SHALL be `variant v` followed by the package version and SHALL NOT contain the date, the hash, or the URL. This SHALL hold when the CLI runs from source, from the built `dist/`, and from the compiled single-file executable.

#### Scenario: Version flag

- **WHEN** a user runs `variant --version` from source in a checkout whose commit id is known
- **THEN** standard output is the `version` in the `variant-cli` `package.json`, a space, and parentheses containing the UTC date of that run, the first eight characters of that commit id, and `https://github.com/jubr/variant-worktrees`, separated by single spaces

#### Scenario: Version flag from a built artifact

- **WHEN** `variant --version` runs from the built `dist/` or from a compiled single-file executable, outside the checkout it was built from
- **THEN** standard output uses the UTC date and the commit captured when that artifact was built, in the same line as a source run

#### Scenario: Version flag without a commit

- **WHEN** a user runs `variant --version` and the commit id cannot be determined
- **THEN** standard output is the `version` in the `variant-cli` `package.json` and contains no parentheses

#### Scenario: Help header

- **WHEN** a user runs `variant --help`
- **THEN** the first line is `variant v` followed by the `version` in the `variant-cli` `package.json`
- **AND** that line does not contain the date, the hash, or the repository URL
