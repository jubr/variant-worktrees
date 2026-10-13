## Why

The CLI, the MCP server, and the VS Code extension run as separate processes. Most variant commands already run in `variant-api`, and they stay there. The extension socket is only for requests that need the editor. Those requests use the same `{name, args}` JSON the API already defines.

## What Changes

- Add workspace library `variant-ipc` that listens on and connects to a Unix domain socket and exchanges one JSON value per line.
- `variant-config` resolves the main `.vscode` directory (`resolveMainVscodeDir`) for a linked checkout container and for a single repo that holds worktrees directly. `settings.json` can distinguish that directory from a package-local `.vscode`.
- `variant-ipc` places the socket at `{resolveMainVscodeDir}/variant-worktrees.sock`.
- A socket request line is `{name, args}`. The success response line is the handler's return value. `config`, `create`, `destroy`, `list`, `switch`, and `provision` are not those requests.
- The extension binds the resolved socket while a workspace is open and removes it on shutdown. It does not execute the lifecycle commands.
- The CLI and the MCP server keep calling `variant-api` in-process.

Non-goals:

- Routing lifecycle commands through the extension.
- A second command schema, a `ping` method, or extra envelope fields around `{name, args}`.
- Changing CLI argument parsing or MCP tool schemas.
- TCP, Windows named pipes, or a socket inside a `_v-*` worktree's own `.vscode/` directory.

## Capabilities

### New Capabilities

- `variant-ipc/unix-socket`: bind, connect, and exchange `{name, args}` JSON without calling `variant-api`.
- `variant-vscode/ipc-endpoint`: extension owns the listener for editor requests only.

### Modified Capabilities

- `variant-api/commands`: lifecycle commands keep executing in `variant-api`, not over the extension socket.
- `variant-config`: `resolveMainVscodeDir` returns the main `.vscode` directory for a symlink container layout and a single-repo layout.

## Impact

- New package `packages/variant-ipc`. `variant-config` gains `resolveMainVscodeDir`. `variant-vscode` binds the socket for editor requests. Lifecycle commands stay in `variant-api`.
- Root build order gains `variant-ipc` before `variant-vscode`.
- Socket file stays untracked. No new network port, credential, or database setting.
