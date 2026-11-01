# variant-api/node-runtime Specification

## Purpose

The library runs on both Node.js and Bun, so editors, MCP clients and scripts can use it without choosing a runtime for their host.

## Requirements

### Requirement: Runs on Node and Bun

The built library, `variant-api` and `variant-api/commands`, SHALL load and run under Node.js 22.13 or newer and under Bun. It SHALL declare `engines.node` as `>=22.13.0`. Loading it SHALL NOT require any Bun-only module or global, and SHALL NOT load a sqlite driver. The library SHALL return the same results under both runtimes.

#### Scenario: Import under Node

- **WHEN** Node.js 22.13 or newer imports the built `variant-api`
- **THEN** the import succeeds

#### Scenario: Import under Bun

- **WHEN** Bun imports the built `variant-api`
- **THEN** the import succeeds

#### Scenario: No driver loaded for other dialects

- **WHEN** a client for a PostgreSQL configuration is created and used under Node
- **THEN** no sqlite module is loaded

#### Scenario: Declared floor

- **WHEN** the `variant-api` package manifest is read
- **THEN** `engines.node` is `>=22.13.0`

### Requirement: SQLite variants under both runtimes

For a SQLite configuration the library SHALL create the database file of a variant, list the variants that have a file, and remove the file, with the same file names under Node and Bun. It SHALL use the sqlite driver of the running runtime, loaded when the first SQLite operation runs. A runtime without such a driver SHALL make a SQLite operation fail with an error that names the dialect and the minimum Node version.

#### Scenario: Create under Node

- **WHEN** `create("test-feature")` runs under Node with a SQLite configuration
- **THEN** the file `test-feature.db` exists in the state directory and `list()` includes `test-feature`

#### Scenario: Create under Bun

- **WHEN** `create("test-feature")` runs under Bun with a SQLite configuration
- **THEN** the same file exists and `list()` includes `test-feature`

#### Scenario: Remove

- **WHEN** a SQLite variant is destroyed under either runtime
- **THEN** its file is gone and `list()` no longer includes it

#### Scenario: Driver missing

- **WHEN** a SQLite operation runs on a Node without `node:sqlite`
- **THEN** it fails with an error that names SQLite and Node 22.13

### Requirement: Implode cleanup patterns on both runtimes

The patterns of `variant.implode.untracked` SHALL match the same files under Node and Bun: `*`, `**`, `?`, character classes and `{a,b}` alternatives, dotfiles included, relative to the worktree. A match outside the worktree SHALL be ignored and a tracked file SHALL never be deleted.

#### Scenario: Wildcard match

- **WHEN** `untracked` is `["openspec/changes/{{slug}}/pr*-demo.webm"]`, an untracked `openspec/changes/demo/pr7-demo.webm` exists and `implode` runs for `demo` under Node
- **THEN** that file is removed

#### Scenario: Alternatives and dotfiles

- **WHEN** `untracked` is `["{out,dist}/**", ".cache/*"]` and untracked files exist in `out/a/b.js`, `dist/c.js` and `.cache/d`
- **THEN** all three are removed under either runtime

#### Scenario: Tracked file kept

- **WHEN** a tracked file matches a pattern
- **THEN** it stays
