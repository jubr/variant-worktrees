## Why

The standalone MCP server ships as its own executable (`variant-mcp`, with a bleed task, a bin of its own and its own client configuration), next to `variant`. Users who installed `variant` still have to install and update a second binary to run the same tools. The release already builds one single-file `variant` per platform; the server belongs in that command, as `variant mcp`.

Two small items ride along: the repository's own Mise file does not yet list the signed `variant` build of this repository, and `variant --help` still prints an empty line between the `Global flags` entries inside GNU screen. The existing fix covered terminals that do not wrap at the last column; the help text pads every table row to the full terminal width, and a terminal that wraps eagerly (GNU screen) turns each full-width row plus its newline into two lines.

## What Changes

- New CLI command `variant mcp [--config <path>]` starts the stdio MCP server in the current directory (`-C <path>` applies as for every command). It prints nothing to standard output except the MCP protocol. The server, tools, results and logging notifications are the ones `variant-mcp` has today.
- **BREAKING**: the `variant-mcp` executable is gone: the package no longer has a `bin`, `task bleed:mcp` and `vw-bleeds/variant-mcp` are removed, and `task bleed:all` publishes the extension and the CLI only. MCP client configurations change from `"command": "variant-mcp"` to `"command": "variant", "args": ["mcp"]`.
- `variant-mcp` stays a workspace package, a library that exports the server start; `variant-cli` bundles it, so `variant mcp` also works from the npm package and from every compiled single-file executable. The extension's bundled `dist/mcp.mjs` keeps working the same way (`--cwd`, same tools) and starts the same code.
- The executable help drops trailing padding: no help line ends in spaces, so the `Global flags` entries (and the `Flags` entries) have no empty line between them in GNU screen, on narrow and wide terminals.
- Docs: README CLI section and MCP section, `docs/guide/commands.md` (section `mcp`), `docs/vscode/mcp.md`, `docs/development/building.md`, `packages/variant-vscode/README.md`, `AGENTS.md`, `CHANGELOG.md` (breaking note).
- `mise.toml` gains `"packslip:jubr/variant-worktrees" = "latest"` under `[tools]`. Repository tooling only; no spec changes.

## Capabilities

### New Capabilities

- `variant-cli/mcp-command`: `variant mcp` as the way to start the standalone MCP server, and the removal of the separate executable.

### Modified Capabilities

- `variant-vscode/mcp-registration`: the bundled script starts the same server as `variant mcp`; the `variant-mcp` bin is no longer kept.
- `variant-api/output-formats`: help lines carry no trailing padding, so no empty line appears between global flags on terminals that wrap at the last column.
- `meta/dev-bleeds`: no MCP bleed; `bleed:all` runs two bleeds; load locations are two.
- `docs/readmes`: the extension README names `variant mcp` instead of `variant-mcp`.

## Impact

- `packages/variant-mcp/src/mcp.ts` (split into a start function and no top-level run), `packages/variant-mcp/package.json` (no `bin`, new exports), `packages/variant-cli/src/` (`mcp` command, `CLI_ONLY_COMMANDS`, `help.ts` trailing-space trim, completions, help tests), `scripts/build-cli.ts` / `scripts/bleed.ts` / `scripts/bleed.spec.ts` / `Taskfile.yaml`, `packages/variant-vscode/src/mcp-entry.ts` and its spec, `packages/variant-api/src/commands.spec.ts` (imports `variant-mcp/bundle`).
- New dependency path: `variant-cli` bundles `variant-mcp` (and with it `@modelcontextprotocol/sdk` and `zod`); `variant-cli` stays free of those at startup of other commands by loading the server lazily.
- Existing `variant-mcp` users and local `mcp.json` files must switch to `variant mcp`. A stale `vw-bleeds/variant-mcp` directory stays on disk until removed by hand.
