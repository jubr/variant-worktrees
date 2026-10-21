# variant-worktrees

V0.0.1 · TypeScript Library / MCP

Typed database variants for applications and AI clients.

```bash
npm install variant-api
```

[Read the Guide](/guide/) · [API Reference](/api/)

## One workflow, two interfaces.

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
