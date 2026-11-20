# Building

Build from a checkout of this repository.
In your own project, install the CLI with mise or the extension instead: see [Installation](/guide/installation).
The packages are not published on npm yet, so the TypeScript library and the MCP server are used from a checkout too.

## Requirements

- [Bun](https://bun.sh/)
- [mise](https://mise.jdx.dev/)

## From source

```bash
git clone https://github.com/jubr/variant-worktrees.git
cd variant-worktrees
mise x -- task bootstrap
mise x -- task build
```

`task bootstrap` trusts the checkout, installs the pinned tools, and installs workspace dependencies.
`task build` builds the workspace: `chat-renamer-config`, `variant-config`, `variant-log`, `variant-ipc`, `variant-api`, `variant-server`, `variant-mcp`, `variant-cli`, `chat-renamer-api`, `variant-ui`, then the `chat-renamer` and `variant-vscode` extensions.

```bash
mise x -- task lint
mise x -- task test
```

## TypeScript library

After `task build`, link the library into your project with Bun:

```bash
cd variant-worktrees/packages/variant-api
bun link

cd path/to/your/project
bun link variant-api
```

`variant-api` runs on Node.js 22.13 or newer and on Bun.
It provides no `variant` command; the CLI does.
SQLite variants use `node:sqlite` under Node and `bun:sqlite` under Bun.
Examples are in [Library](./library).

## MCP server

After `task build`, run the MCP server through the built CLI (`variant-mcp` is the library behind `variant mcp`) with a workspace configuration:

```bash
node variant-worktrees/packages/variant-cli/dist/cli.js mcp --config /workspace/variants.yaml
```

Point an MCP client at that command. The client configuration is in [MCP Server](/vscode/mcp).
