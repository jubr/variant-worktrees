## Context

CLI, MCP, and the VS Code extension are separate OS processes. The extension already activates on startup and reads `vscode.workspace.workspaceFolders`. There is no shared local channel. See proposal.md for why this change adds one. Behavioral requirements are in the delta specs.

Constraints: Bun workspace, TypeScript strict ESM, Zod v4, Biome. New libraries follow the unscoped `packages/*` pattern. `variant-vscode` bundles its dependencies with esbuild and externalizes only `vscode`. Tests are `bun:test`, colocated as `src/*.spec.ts` per CONTRIBUTING.md.

## Goals / Non-Goals

**Goals:**

- One library package that binds, connects, frames, and discovers the project socket.
- Extension hosts the listener; other processes only connect.
- Real Unix sockets in tests, under temporary directories.

**Non-Goals:**

- Application methods other than `ping`.
- Importing the library from `variant-api` or `variant-mcp` in this change. Those packages call it when a later change has messages to send.
- Publishing a TypeDoc entry. TypeDoc currently documents `variant-api` only.

## Decisions

- Package name `variant-ipc`. Same unscoped workspace style as `variant-config`. A `lib-ipc` package name would break that pattern.
- Node `net` Unix sockets, which Bun implements. No new dependency. TCP and named pipes are out of scope.
- Extension is the only listener. The request places the socket file from the extension, so CLI and MCP stay clients.
- Path segment is `vscode/variant-worktrees.sock`, not `.vscode/`. The request names that path. Putting the socket in `.vscode` would hide it from clients that follow the stated relative path.
- Framing is newline-delimited JSON with `id`, `method`, and optional `params`, validated by Zod. A raw byte stream would push a second, incompatible envelope into every consumer. Length-prefix framing is harder to inspect in tests for no current payload need.
- `ping` is the only method. Unknown methods and invalid lines return an error response and do not stop the listener.
- Discovery is a filesystem walk from a start directory. It does not read git metadata or `variants.yaml`. The nearest `vscode/variant-worktrees.sock` wins.
- A path is live when a connect succeeds. A leftover socket or a non-socket file at that path is unlinked and replaced. A live socket is left alone and the new listen fails.
- Socket mode is owner read/write only. A `vscode/` directory created by the listener is owner-access only. An existing directory keeps its mode so a project that already has `vscode/` is not locked down.
- The extension starts one listener per `workspaceFolders` entry and disposes those listeners on deactivation. Disposal unlinks only sockets that this activation bound.
- esbuild bundles `variant-ipc` into the extension. `node:net` stays available in the extension host; do not add it to `external`.
- Ignore `vscode/*.sock` so the endpoint is never committed.

## Risks / Trade-offs

- [Risk] Two extension hosts for the same folder both try to bind → Mitigation: the second bind fails and must not unlink the live socket.
- [Risk] A crash leaves a stale socket file → Mitigation: replace the path when connect fails, then bind.
- [Risk] A project already uses a `vscode/` directory → Mitigation: add only the sock file, leave directory mode unchanged, gitignore `*.sock`.
- [Risk] Group/other bits survive umask if chmod is skipped → Mitigation: chmod the socket after bind and assert group/other bits are clear in tests.
- [Risk] NDJSON breaks if a future payload embeds a raw newline → Mitigation: keep this change to single-line JSON objects; revisit framing only when a payload needs embedded newlines.

## Migration Plan

No data or configuration migration. Ship the library and the extension listener together. Rollback by removing the listener from extension activate/deactivate and deleting the package. A leftover `vscode/variant-worktrees.sock` is inert and can be deleted; the next listen replaces it.
