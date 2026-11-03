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
- `variant_list({ verbose })` — list state and database variants with their mode, uptime and watch log file; with `verbose` every item carries all meta information, the same as `variant_status`.
- `variant_status({ slug })` — everything known about one variant: the facts of `variant_list` plus a `runtime`
  object with its runtime state (mode, directory, database settings with the password hidden, and per watch the
  port, pid, URL, liveness and uptime). An unknown slug is an error.
- `variant_create({ slug })` — create an isolated variant.
- `variant_provision({ slug, verbose })` — run configured install, env file, `up`, step and seed commands.
- `variant_up({ slug, verbose })` — recreate the database and run the watches as containers; returns the
  mode, worktree, database target, and the port, URL and container name of each watch.
- `variant_down({ slug })` — stop the processes and containers of a variant and keep its data.
- `variant_watch({ slug, verbose })` — start the watch processes detached and return their pids, ports and
  URLs; their output goes to `variants.watch.log` in the worktree (see `log` of `variant_status`). A tool call cannot stay attached to a console, so `detach` is always set.
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
