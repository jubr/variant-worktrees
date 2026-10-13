## Context

CLI, MCP, and the VS Code extension are separate OS processes. Command names and argument objects already live in the API command list: `config`, `create`, `destroy`, `list`, `switch`, and `provision`. `variant-config` already resolves a variant root from a parent `AGENTS.md` symlink, then from the git directory that holds the real `AGENTS.md`. See proposal.md for why this change adds a socket. Behavioral requirements are in the delta specs.

Constraints: Bun workspace, TypeScript strict ESM, Zod v4, Biome. Tests are `bun:test`, colocated as `src/*.spec.ts` per CONTRIBUTING.md. `variant-vscode` bundles dependencies with esbuild and externalizes only `vscode`.

## Goals / Non-Goals

**Goals:**

- `resolveMainVscodeDir` in `variant-config` for both directory layouts.
- One socket library that binds, connects, and exchanges `{name, args}` JSON for editor requests.
- Lifecycle commands stay on the in-process `variant-api` path the CLI and MCP already use.

**Non-Goals:**

- Teaching `variant-ipc` or the extension to execute `config`, `create`, `destroy`, `list`, `switch`, or `provision`.
- A second command schema for the editor requests. Their JSON uses the same `name` and `args` fields.
- TypeDoc for `variant-ipc`. TypeDoc currently documents `variant-api` only.

## Decisions

- Package name `variant-ipc`, same unscoped workspace style as `variant-config`.
- Node `net` Unix sockets, which Bun implements. No new dependency for the transport.
- `resolveMainVscodeDir` lives in `variant-config` and returns the main `.vscode` directory, even when `variant-worktrees.sock` is absent. Linked layout: parent `AGENTS.md` symlink selects `variant-worktrees/.vscode`, and a container `.vscode` symlink points at that same directory. Single-repo layout: the directory that holds the real `AGENTS.md` and the `_v-*` siblings owns the `.vscode` directory. Worktree-local `.vscode/` is never the result.
- `settings.json` assists that choice. Package `.vscode` folders in this repo hold `launch.json` and `tasks.json` and no `settings.json`. The main checkout `.vscode` holds `settings.json`. A worktree can also hold `settings.json`, so the file breaks a package-local tie and does not override the variant-root rules.
- `variant-ipc` builds the socket path as `{resolveMainVscodeDir}/variant-worktrees.sock`. It does not walk the directory tree itself.
- Request line is `{"name":"<command>","args":{...}}`. Success response line is the handler return value alone. Failures use `{"error":{"message":"..."}}`.
- `variant-ipc` stays free of `variant-api` and calls a supplied handler. That handler is for editor requests. Library tests use a stub handler. Extension tests show the listener is up and that a lifecycle name is not executed there.
- One listener per resolved path. Two workspace folders that resolve to the same file share one listener.
- esbuild bundles `variant-ipc` and `variant-config` into the extension. Do not externalize `node:net`.
- Ignore `.vscode/variant-worktrees.sock`.

## Risks / Trade-offs

- [Risk] Two extension hosts resolve the same file and both bind → Mitigation: the second bind fails and must not unlink the live socket.
- [Risk] A crash leaves a stale socket file → Mitigation: replace the path when connect fails, then bind.
- [Risk] A worktree `.vscode/` is mistaken for the endpoint → Mitigation: tests for both layouts assert the variant-root path.
- [Risk] An implementer routes `create` or `list` through the extension → Mitigation: specs require those commands to run in `variant-api`, and extension tests refuse that path.
- [Risk] Group/other bits survive umask if chmod is skipped → Mitigation: chmod the socket after bind and assert group/other bits are clear in tests.
- [Risk] A future API return value could contain a raw newline and break the line framing → Mitigation: `JSON.stringify` escapes newlines inside strings. Keep one JSON value per line.

## Migration Plan

No data or configuration migration. Ship the resolver, the library, and the extension listener together. Rollback by removing the listener from extension activate/deactivate and deleting the resolver and package. A leftover `.vscode/variant-worktrees.sock` is inert and can be deleted; the next listen replaces it.
