# Installation

`variant-cli`, `variant-api` and `variant-mcp` run on Node.js 22.13 or newer and on Bun.

## CLI

```bash
npm install -g variant-cli
```

This provides the `variant` command. Releases also ship `variant` as a single-file executable for Linux, macOS and Windows.

## TypeScript library

```bash
npm install variant-api
```

```bash
bun add variant-api
```

The library provides no `variant` command; install `variant-cli` for that. SQLite variants use `node:sqlite` under Node and `bun:sqlite` under Bun.

## MCP server

```bash
npm install -g variant-mcp
```

Or run it with `npx`:

```bash
npx -y variant-mcp
```
