# Introduction

**variant-worktrees** provides typed database variants for isolated git
worktrees through a TypeScript library, CLI, and MCP server.

## Quick start

```bash
variant config
variant create -s preview-one
variant list
variant destroy -s preview-one
```

Use `-s`/`--slug` to override git detection. Without it, the current
worktree branch determines the variant slug.

## MCP

Configure `variant-mcp` with the workspace `variants.yaml`. It exposes tools for
configuration, creation, listing, switching, provisioning, and destruction.

## Requirements

- Bun
- PostgreSQL, MySQL, or SQLite
- `mise.local.toml` or matching database environment variables
