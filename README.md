# variant-worktrees

![variant-worktrees](./packages/variant-vscode/media/icon-256.png)

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
    fe:
      kind: vite
      dir: fe
      open: http://{{slug}}.vw.localhost:{{port}}
    be:
      kind: nestjs
      dir: be
```

The [`example/`](./example) project shows a complete setup (Vite + NestJS on SQLite). The
[guide to replacing shell scripts](./docs/guide/scripts.md) lists every runtime option.

Database settings load from `mise.local.toml` first, then environment
variables. Explicit `db` values in `variants.yaml` override autodetected
values.

Instances take an optional `open` URL template (`{{slug}}`, `{{port}}`; autodetected Vite instances get `http://{{slug}}.vw.localhost:{{port}}`) and an optional `dotenv` file, relative to `dir`, that is copied for a variant and amended with its values (`amendDotenv`, `dotenvFor`). Ephemeral state of a variant lives in `variants.local.yaml` in its worktree (git-ignored): a `runtime` section with `slug`, `mode`, `dir`, `db` (the `db` settings, port may be `'{{POSTGRES_PORT}}'` from the environment) and `instances.<name>.{port,pid,url}`; see [`variants.local.example.yaml`](./packages/variant-config/variants.local.example.yaml). `{{port}}` is `runtime.instances.<name>.port`, otherwise a random free port. `up` and `watch` write the section; `list` and `down` read it.

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
variant up -s preview-one              # instances as containers on a fresh database
variant watch -s preview-one --detach  # instances as host processes
variant down -s preview-one            # stop them, keep the data
variant implode -s preview-one         # tear down and remove the worktree
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

Tools: `variant_config`, `variant_create`, `variant_list`, `variant_switch`,
`variant_provision`, `variant_up`, `variant_down`, `variant_watch` (always
detached), and `variant_implode`.

## Development

```bash
mise x -- task install
mise x -- task lint
mise x -- task build
mise x -- task test
```

## License

MIT
