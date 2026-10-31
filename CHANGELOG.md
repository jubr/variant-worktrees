# Changelog

## Unreleased

### Added

- `variant completions <shell>` prints a completion script for `zsh`, `bash`, or `fish`. It completes the subcommands,
  their flags, and the slugs of existing variants; the scripts derive from the CLI's own command definitions.
  `variant completions --list-slugs` prints those slugs from local variant state and worktrees.

## 0.0.4

### Fixed

- `variant --version` and `--help` report the package version instead of a fixed `v0.0.1`.

### Removed

- **BREAKING** The `switch` command: the `variant switch` CLI command, the `variant_switch` MCP tool,
  `client.switch()` and the `switchWorktree` export. It only changed the working directory of the process
  that ran it. `create` still ensures the `_v-*` worktree and returns its path.

## 0.0.1

### Added

- Shared `variant-config` package for YAML and mise/environment discovery.
- `variant-api` lifecycle client and `variant` CLI.
- `variant-mcp` tools for database variant operations.
