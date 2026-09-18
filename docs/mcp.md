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
- `variant_destroy({ slug })` — remove an isolated variant.
- `variant_switch({ slug })` — switch process context to its `_v-*` worktree.
- `variant_provision({ slug })` — run configured runtime and seed commands.

`slug` is optional for operations that support git worktree detection. Explicit
slugs always take precedence.

## Testing

```bash
mise x -- bun test packages/variant-mcp/test/mcp.test.ts
```
