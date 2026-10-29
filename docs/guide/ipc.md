# Editor socket

`config`, `create`, `list`, `provision`, `up`, `down`, `watch`, and
`implode` run in `variant-api`. The CLI and the MCP server call that logic in-process. Those
commands are not sent to the VS Code extension.

Requests that need the editor are the socket traffic. Each request line is one
JSON object, `{"name":"<command>","args":{...}}`. The success response line is
the handler's return value, with no extra envelope.

## Socket file

`resolveMainVscodeDir` returns the absolute path of the main checkout
`.vscode` directory. It does not create that directory and it does not append
a file name. The socket file is `variant-worktrees.sock` inside the directory
`resolveMainVscodeDir` returns.

A `.vscode` directory inside a `_v-*` worktree is never that directory. A
package `.vscode` that has no `settings.json` loses to the main checkout
`.vscode` when that directory contains `settings.json`.

## Linked checkout

The container's `AGENTS.md` is a symlink to the main checkout, and the
container `.vscode` entry is a symlink to the same `.vscode` directory. For a
worktree such as `_v-lib-ipc`, a nested path inside that worktree, the
container root, or the main checkout, `resolveMainVscodeDir` is the main
checkout's `.vscode`. The socket path is
`variant-worktrees/.vscode/variant-worktrees.sock`. A `settings.json` file
inside the worktree does not move the socket.

## Single repo

The directory that contains the real `AGENTS.md` also contains the `_v-*`
worktrees. `resolveMainVscodeDir` is that directory's `.vscode`, whether
resolution starts at a worktree, a nested path inside the worktree, or the
repo root. The socket path is `.vscode/variant-worktrees.sock` on that
directory. A worktree `.vscode`, including one that contains `settings.json`,
is not the endpoint.
