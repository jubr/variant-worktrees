# variant-worktrees

Typed database variants for git worktrees, exposed through a TypeScript library,
CLI, and MCP server.

## Packages

- [`variant-config`](./packages/variant-config) — `variants.yaml` schema and
  mise/environment autodetection.
- [`variant-api`](./packages/variant-api) — lifecycle library and `variant`
  CLI.
- [`variant-mcp`](./packages/variant-mcp) — MCP tools for variant lifecycle
  operations.
- [`variant-vscode`](./packages/variant-vscode) — VS Code extension package.

## Configuration

Create `variants.yaml` at workspace root:

```yaml
variant:
  up: bun run db:migrate
  watch: bun run dev
  instances:
    - kind: vite
      dir: app
    - kind: nestjs
      dir: server
seed: bun run db:seed
```

Database settings load from `mise.local.toml` first, then environment
variables. Explicit `db` values in `variants.yaml` override autodetected
values.

## CLI

```bash
variant config
variant create -s preview-one
variant list
variant provision -s preview-one
variant destroy -s preview-one
```

Without `-s`/`--slug`, the CLI derives a slug from the current git worktree.
PostgreSQL and MySQL use isolated schemas/databases; SQLite uses one database
file per variant.

## MCP

Configure an MCP client to run:

```json
{
  "mcpServers": {
    "variant": {
      "command": "variant-mcp",
      "args": ["--config", "/workspace/variants.yaml"]
    }
  }
}
```

Tools: `variant_config`, `variant_create`, `variant_destroy`, `variant_list`,
`variant_switch`, and `variant_provision`.

## Development

```bash
mise x -- task install
mise x -- task lint
mise x -- task build
mise x -- task test
```

## License

MIT
