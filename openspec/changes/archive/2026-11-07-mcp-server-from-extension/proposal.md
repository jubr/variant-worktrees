## Why

Installing the extension does not put the variant tools in Cursor or VS Code chat. The user has to install `variant-mcp` on `PATH` and point an `mcp.json` entry at the repo. DBCode avoids that by registering its MCP server from the extension, so the editor lists it with the extension as the source. Variant should do the same for the open workspace, and the standalone server should stay for clients outside the editor.

## What Changes

- When the extension activates with a workspace folder, it registers one stdio MCP server named `variant` with the editor host.
- On Cursor, registration uses `vscode.cursor.mcp.registerServer`. On a host that has no Cursor MCP API, registration uses `vscode.lm.registerMcpServerDefinitionProvider` and the `mcpServerDefinitionProviders` contribution. A session uses one of those APIs.
- The editor spawns its own Node on a script bundled in the extension. That process is the existing MCP server, with the workspace folder as its working directory, so it exposes the same tools as `variant-mcp`.
- No workspace folder, or neither host API, still activates successfully and registers nothing. Cursor registration is removed on deactivate.
- The `variant-mcp` binary, its stdio transport, `--config`, and the manual `mcp.json` setup stay as they are.

Non-goals:

- Replacing the standalone server, or proxying it through the extension.
- Running the MCP session inside the extension host, or adding an HTTP or SSE transport.
- Drawing the editor's MCP configure dialog. The extension only registers; the host owns that dialog and its source toggle.
- A second tool catalog, or sending lifecycle commands over the extension's Unix socket.
- Registering a server per workspace folder. The first folder is the working directory, as it is for the Variants view.
- An extension setting that disables registration. The host's source toggle is the control.

## Capabilities

### New Capabilities

- `variant-vscode/mcp-registration`: the extension registers the existing MCP server with Cursor or VS Code for the open workspace, and leaves the standalone server in place.

### Modified Capabilities

None.

## Impact

- `packages/variant-vscode`: the `mcpServerDefinitionProviders` contribution, activation and deactivate, a bundled stdio entry that starts the existing server in the workspace folder, the VS Code mock, manifest and activation tests, the extension README, and `CHANGELOG.md`.
- `docs/mcp.md`: the extension registers itself in Cursor and VS Code. The standalone setup section stays.
- `packages/variant-mcp`: no new tools and no change to the default launch. The extension bundle consumes that server; it does not replace the `variant-mcp` bin.
