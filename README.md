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
  seed: bun run db:seed
  instances:
    - name: fe
      kind: vite
      dir: packages/example-fe
      open: http://{{slug}}.vw.localhost:{{port}}
    - name: be
      kind: nestjs
      dir: packages/example-be
```

Database settings load from `mise.local.toml` first, then environment
variables. Explicit `db` values in `variants.yaml` override autodetected
values.

`open` is only valid on Vite instances (autodetected ones get `http://{{slug}}.vw.localhost:{{port}}`). `{{port}}` is the port assigned in `.cache/variants/<slug>.yaml` (`spa_port` for Vite, `api_port` for NestJS; directory set by `variant.cacheDir`), otherwise a random free port. `openUrlFor` in `variant-config` fills the template; nothing launches it yet.

`variant.prefix` (default `_v-`, connector included) starts every name derived from a
slug, such as worktree directories (`_v-add-auth`). The optional `chatRenamer` section
configures the Cursor chat renamer in `variant-vscode`. Every option is listed in
[`variants.example.yaml`](./packages/variant-config/variants.example.yaml), next to the
[JSON schema](./packages/variant-config/variants.yaml.schema.json).

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
