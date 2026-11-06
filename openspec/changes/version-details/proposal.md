## Why

`variant --version` prints only the package version, so a binary, a `dist/` install, and a source checkout cannot be told apart. The build date, the commit, and the project URL are the facts needed to match a running CLI to a build.

## What Changes

- **BREAKING** `variant --version` no longer prints the version alone. It prints one line: the `variant-cli` package version, a space, then parentheses holding three space-separated fields: the build date as `YYYY-MM-DD` in UTC, the git commit hash truncated to eight lowercase hex characters, and the GitHub repository URL `https://github.com/jubr/variant-worktrees`.
- The same line is printed from source, from the built `dist/cli.js` (Node and Bun), and from the compiled single-file executable. The date and hash in `dist/` and in the executable are the ones captured when that artifact was built, so `--version` still prints them away from a git checkout. A source run reads the checkout that contains the CLI and uses the UTC date of that process start.
- When the commit hash cannot be read and nothing was captured at build time, `--version` prints the package version alone, with no parentheses.
- The first line of `variant --help` stays `variant v` followed by the package version, with no parenthetical. `-v` stays the verbose flag.

Example shape, with placeholders rather than a real build: `1.2.3 (YYYY-MM-DD abcdef01 https://github.com/jubr/variant-worktrees)`.

Assumption: the GitHub URL is the repository URL, not a commit URL. The short hash already identifies the commit.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `variant-api/commands`: `variant --version` prints the version plus the parenthetical build date, short hash, and repository URL, from source, `dist/`, and the compiled executable. Help stays the package version.
- `variant-cli/package`: `--version` under Node and under Bun prints that same line, not the version alone.

## Impact

- `variant-cli` argument handling, the CLI build, and `scripts/package-cli.ts` (the stamp has to be inside `dist/` and the executable).
- Tests that expect `--version` to equal the package version.
- README, `docs/guide/core.md`, and `CHANGELOG.md`, where `--version` is described as showing the version.

## Non-goals

- A parenthetical on `variant --help`, or any change to `-v` / `--verbose`.
- A `-dirty` suffix, a commit URL, or a different repository URL per package.
- Changing the MCP server's reported version, the VS Code extension version, or the executable file names.
