## Why

Port Berner fire-protection variant worktree infrastructure (schema isolation, watch-mode lifecycle, state persistence) into a reusable TypeScript library + CLI + MCP server. The reference shell scripts hard-code Postgres, Docker, and Berner-specific paths. A generic library enables any Bun/Node workspace to adopt database-per-feature-branch patterns without copy-paste.

## What Changes

- **New package** `variant-config`: reads `variants.yaml` schema + detects mise/env connection config + `config` CLI command
- **Rewrite `variant-api`**: remove BuiltWith API, add DB variant ops (create/destroy/list/switch schemas), multi-DB abstraction (Postgres schemas, SQLite files, prefixed tables)
- **Rewrite `variant-mcp`**: remove `variant_free` tool, add `variant_list`, `variant_create`, `variant_destroy`, `variant_switch`, `variant_provision`
- **CLI library** cleye → command routing from `commands.ts` (port existing pattern from docs/cli-vscode-webview.md)
- **VS Code extension** enhancement: auto-register commands, webview forms (future work after CLI)
- **State storage**: `.cache/variants/*.yaml` with yq compat (matches reference)
- **Worktree integration**: `-s/--slug` explicitly overrides git-based slug detection; `variant.root` or AGENTS/git-root autodetection determines where `_v-$slug` worktrees live
- **Runtime orchestration hooks**: use explicit `variant.instances[]` config when present; otherwise autodetect Vite/NestJS instances by searching subdirectories from the directory containing `variants.yaml`, with abstract `variant.up` / `variant.watch` commands

## Capabilities

### New Capabilities

- `variant-config`: config file schema, autodetection (mise → env), validation, `config` CLI command
- `variant-api/core`: DB variant lifecycle (create/destroy/list schemas), multi-DB strategy (schema-per-variant where supported, database-per-variant otherwise), slug resolution (git-based + explicit), state persistence (YAML), worktree coupling
- `variant-api/commands`: command definitions for CLI + MCP + VS Code (port existing `CommandDefinition` pattern)
- `variant-mcp/tools`: MCP tool surface (`variant_list`, `variant_create`, `variant_destroy`, `variant_switch`, `variant_provision`)

### Modified Capabilities

<!-- None — this is a pivot, not an enhancement of existing BuiltWith behavior -->

## Impact

- **Breaking**: `variant-api` public surface changes from `createClient().free(lookup)` to `createClient().create(slug)` etc
- **Breaking**: `variant-mcp` tool `variant_free` removed, replaced with variant lifecycle tools
- **New dependencies**: cleye (CLI), Drizzle ORM with dialect drivers, YAML/TOML parsers
- **Config artifact**: `variants.yaml` at workspace root (user-created, JSON schema validated)
- **Docs**: VitePress user guide for setup + workspace adoption
