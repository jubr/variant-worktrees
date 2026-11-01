# Changelog

## Unreleased

### Added

- `variant status [slug]` (and the `variant_status` MCP tool): everything known about one variant, including all
  meta information of its runtime state (mode, directory, database settings with the password hidden, and per
  instance the port, pid, URL, liveness and uptime).
- Global `--json` and `--yaml` flags on every command, listed in a `Global flags` help section and README
  subsection apart from the flags of each command.
- `-v` as the short form of `--verbose`. On `list` (and `variant_list`) it shows all meta information of every
  variant, the same as `status`.
- Variants report `uptimeSeconds` (how long their live recorded processes have run) and `log`.
- A detached `watch` writes the output of all its processes to `variants.watch.log` in the worktree and records
  the path as `runtime.log`, so it can be followed with `tail -f`.
- CONTRIBUTING requires new commands and functionality to be added to the README and the documentation.
- `variant.main`: the main checkout the worktrees are made from (default: the target of a parent `AGENTS.md`
  symlink, else the git checkout).
- A worktree created inside the main tree adds `_v-*` (the configured prefix) to an existing `.gitignore`.

### Changed

- **BREAKING** `variant.root` is only the directory that holds the worktrees. With a parent `AGENTS.md` symlink into
  the main checkout it now defaults to the directory that holds the symlink, so `variant watch foo` creates
  `<parent>/_v-foo` instead of `<main>/_v-foo`. Without the symlink it stays the main checkout. The resolved
  `variant.root` of `loadConfig` follows; use the new `variant.main` for the main checkout. Set `variant.root` to
  the main checkout to keep the old place; existing worktrees are still found by slug.
- **BREAKING** The CLI prints a text summary instead of JSON by default. Add `--json` to get the previous output.
- **BREAKING** `variant list` prints the table `slug, mode, uptime, url, log, dir` by default; the `schema`
  column moved to `list -v`/`--json`.

### Removed

- **BREAKING** `variant list --table`; the table is the default.

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
