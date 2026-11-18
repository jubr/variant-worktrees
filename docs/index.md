# variant-worktrees

Variant Worktrees manages git worktrees, database schemas, watches, environment variables, and implodes.
It comes as a CLI, an MCP server, a VS Code extension, and a library.

```bash
mise x github:jubr/variant-worktrees@latest -- variant init
```

[Getting Started](/guide/) · [Installation](/guide/installation) · [API Reference](/api/)

## Library and MCP

### TypeScript SDK

Create and manage isolated database variants from TypeScript.

```ts
await client.create("preview-one")
```

[Library](/guide/library)

### AI Assistant

Manage variants from Claude, Cursor, or any MCP client.

```bash
variant-mcp --config variants.yaml
```

[MCP](/mcp)
