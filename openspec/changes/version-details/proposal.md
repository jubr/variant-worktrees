## Why

`variant --version` prints only the package version, so a binary, a `dist/` install, and a source checkout cannot be told apart. The build date, the commit, and the project URL are the facts needed to match a running CLI to a build.

## What Changes

- **BREAKING** `variant --version` no longer prints the version alone. The first line is the version token and the UTC build time in parentheses, as in `0.0.7-version-details-4-abcd (2001-02-03 04:05:06)`. Then a cursive ASCII drawing of `Variant-Worktrees` (capital V, capital W). Then a blank line. Then the platform and the repository URL, separated by a comma. The drawing is colored orange when standard output is a terminal and `NO_COLOR` is unset. Otherwise the same drawing is plain text. The first line and the details line are not colored.
- The platform is `macos`, `linux`, or `windows`, a hyphen, and the CPU architecture, as in `macos-arm64`. The details line is `macos-arm64, https://github.com/jubr/variant-worktrees`. It does not contain a date or a commit hash.
- The build sets a string called `variant`. On `main` it is empty. On any other branch it is `{slug}-{n}-{hash4}`: `slug` is that branch with `feat/`, `fix/`, and `feature/` removed and sanitized the same way as a variant slug, `n` is the number of commits since the nearest tag reachable from that commit, and `hash4` is the first four lowercase hex characters of the commit. The cutoff is fixed at four characters and does not grow to stay unique. When `variant` is not empty, the version token is the package version, a hyphen, and that string: `0.0.7-version-details-4-abcd`. A feature branch with zero commits since the tag still prints the string (`slug-0-hash4`). When `variant` is empty, the version token is the package version alone.
- The same output is printed from source, from the built `dist/cli.js` (Node and Bun), and from the compiled single-file executable. The date, the hash, and `variant` in `dist/` and in the executable are the ones captured when that artifact was built, so `--version` still prints them away from a git checkout. A source run reads the checkout that contains the CLI and uses the UTC date of that process start. The platform is always the runtime that is executing the CLI.
- When the commit hash cannot be read and nothing was captured at build time, the first line is the package version and the build time, with no `variant` suffix. The details line is still the platform and the URL.
- The first line of `variant --help` stays `variant v` followed by the package version. Help has no banner, no platform, and no parenthetical. `-v` stays the verbose flag. Executable file names keep the package version, with no `variant` suffix.

From `main` the first line is `1.2.3 (2001-02-03 04:05:06)` and the last line is `macos-arm64, https://github.com/jubr/variant-worktrees`.

From `feat/version-details`, four commits after the tag, the first line is `1.2.3-version-details-4-abcd (2001-02-03 04:05:06)` and the last line is the same.

The GitHub URL is the repository homepage. The four-character hash appears only in the `variant` suffix.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `variant-api/commands`: `variant --version` prints the cursive `variant-worktrees` banner, then the version token, the runtime platform, and parentheses holding the build date and the repository URL. Off `main` the version token gains `-{slug}-{n}-{hash4}`. Help stays the package version.
- `variant-cli/package`: `--version` under Node and under Bun prints that same line, not the version alone.

## Impact

- `variant-cli` argument handling, the CLI build, and `scripts/package-cli.ts` (the stamp has to be inside `dist/` and the executable).
- Tests that expect `--version` to equal the package version.
- README, `docs/guide/core.md`, and `CHANGELOG.md`, where `--version` is described as showing the version.

## Non-goals

- A parenthetical or the banner on `variant --help`, or any change to `-v` / `--verbose`.
- An upgrade warning, or an attribution line next to the banner.
- A `-dirty` suffix, a commit URL, or a different repository URL per package.
- Putting the `variant` suffix on executable file names or in `package.json`.
- Changing the MCP server's reported version, the VS Code extension version, or the executable file names.
