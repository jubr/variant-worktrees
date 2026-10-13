## Why

The CLI, the MCP server, and the VS Code extension run as separate processes and have no shared local channel. A Unix domain socket owned by the extension gives those processes one project-scoped way to reach each other without TCP ports or environment wiring.

## What Changes

- Add workspace library `variant-ipc` that listens on and connects to a Unix domain socket, exchanges newline-delimited JSON requests and responses, and resolves the socket by walking parent directories.
- Fix the socket location at `vscode/variant-worktrees.sock` under the project root. The extension creates that file while a workspace folder is open and removes it on shutdown.
- Expose one `ping` method so a client can prove the endpoint is live.
- Leave variant lifecycle operations, MCP tools, and CLI commands on their current paths.

Non-goals:

- Routing create, destroy, list, switch, or provision over the socket.
- Changing MCP tool schemas or CLI invocation.
- TCP, Windows named pipes, or a socket outside the project tree.
- Relaying messages between CLI and MCP except through the extension listener.

## Capabilities

### New Capabilities

- `variant-ipc/unix-socket`: bind, connect, frame, and discover `vscode/variant-worktrees.sock`.
- `variant-vscode/ipc-endpoint`: extension owns the listener for each open workspace folder.

### Modified Capabilities

None.

## Impact

- New package `packages/variant-ipc`, consumed by `variant-vscode` and available to `variant-api` and `variant-mcp`.
- `variant-vscode` activation starts the listener; deactivation unlinks the socket.
- Root build order gains `variant-ipc` before its consumers.
- Socket file stays untracked. No new network port, credential, or database setting.
