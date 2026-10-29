# MCP Server

`variant-mcp` exposes database variant lifecycle operations to MCP clients.

## Setup

Run the server with a workspace configuration:

```bash
variant-mcp --config /workspace/variants.yaml
```

MCP client configuration:

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

## Available tools

- `variant_config` — print resolved configuration.
- `variant_list` — list state and database variants.
- `variant_create({ slug })` — create an isolated variant.
- `variant_provision({ slug, verbose })` — run configured install, dotenv, `up`, step and seed commands.
- `variant_up({ slug, verbose })` — recreate the database and run the instances as containers; returns the
  mode, worktree, database target, and the port, URL and container name of each instance.
- `variant_down({ slug })` — stop the processes and containers of a variant and keep its data.
- `variant_watch({ slug, verbose })` — start the instance processes detached and return their pids, ports and
  URLs. A tool call cannot stay attached to a console, so `detach` is always set.
- `variant_implode({ slug, force })` — stop the variant, drop its database and storage, clear its state and
  remove its worktree. It refuses `main` and work that is not merged into the base branch; the error names
  `force`, which overrides the gate.

There is no `variant_destroy`; `variant_implode` replaces it.

`slug` is optional for operations that support git worktree detection. Explicit
slugs always take precedence.

## Testing

```bash
mise x -- bun test packages/variant-mcp/test/mcp.test.ts
```
