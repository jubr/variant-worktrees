## Context

See proposal.md for why. `packages/variant-mcp/src/mcp.ts` is a stdio script: it parses `--config` with strict `parseArgs`, loads config from `process.cwd()`, and registers one tool per command. Its package bin is `variant-mcp` → `dist/mcp.js`, and that build externalizes `variant-api`. The extension is a separate esbuild bundle, `dist/extension.cjs`, packaged with `vsce --no-dependencies`, so a child process cannot load that externalized `dist/mcp.js` from the vsix. `vscode.lm.registerMcpServerDefinitionProvider` and `McpStdioServerDefinition` are in the installed engine types. The constructor is positional `(label, command, args, env, version)`; `cwd` is assigned afterwards. The types describe `process.execPath` as the editor's Node, and `env` as overrides on the extension-host environment. Cursor's API is `vscode.cursor.mcp.registerServer` / `unregisterServer` and has command, args, and env, and no cwd. The extension already uses the first workspace folder for its views and activates on `onStartupFinished`.

## Goals / Non-Goals

**Goals:**

- Register one editor-spawned stdio process whose script is bundled in the vsix and whose code is `variant-mcp`'s server.
- Keep that server's argv parser unchanged by stripping `--cwd` before it runs.

**Non-Goals:**

- Re-registering when the workspace folders change after activation.
- Importing the MCP entry from `extension.ts` or from the extension host bundle.
- Bumping `engines.vscode` past `^1.101.0`.

## Decisions

### Cursor API wins when both exist

On activate, if `vscode.cursor.mcp.registerServer` is a function, call it and do not call `vscode.lm.registerMcpServerDefinitionProvider`. Otherwise, if the VS Code function exists, register provider id `variant`. A missing function is skipped. Cursor is a VS Code fork, so both can exist in one window; registering both would list two servers. Deactivate calls `unregisterServer("variant")` only after a Cursor registration. The VS Code disposable goes on `context.subscriptions`.

Alternative considered: always register the VS Code provider, including on Cursor. That misses the Cursor configure dialog this change is matching when Cursor only shows `vscode.cursor.mcp` registrations, and it duplicates the server when both APIs are live. Rejected.

The `vscode.cursor` namespace is not in `@types/vscode`. A `declare module "vscode"` block in the extension, copied from Cursor's extension API reference, types `registerServer` and `unregisterServer`. No extra dependency.

### The editor spawns a bundled ESM script

A second esbuild build, separate from the default CommonJS config, writes `dist/mcp.mjs` with `format: "esm"`, `platform: "node"`, `target: "node22"`, `bundle: true`, and `external: ["bun:sqlite"]`. It does not use the CommonJS `import.meta.url` banner; the ESM bundle has a real `import.meta.url`. The entry is `packages/variant-vscode/src/mcp-entry.ts`, which imports `packages/variant-mcp/src/mcp.ts` by relative path so esbuild inlines `variant-api`. Importing the `variant-mcp` package name would load `dist/mcp.js`, which externalizes `variant-api` and cannot run from the vsix. `.vscodeignore` already ships `dist/*`.

`mcp-entry.ts` reads `--cwd <directory>`, `process.chdir`s there, splices that flag out of `process.argv`, then imports the server. `mcp.ts` keeps `strict: true` and only `--config`. No `--cwd` means no `chdir`.

Alternative considered: add `--cwd` to `mcp.ts`. That changes the standalone parser for a flag only the extension needs. Rejected. Alternative considered: CommonJS for this entry too. The server and the SDK use top-level await, and the CommonJS banner would overwrite a real `import.meta.url`. Rejected. Alternative considered: an HTTP server inside the extension host. Both host APIs are built for the editor to spawn stdio or dial a URL, and a listening port is what DBCode left behind. Rejected.

### Launch command

Both registrations use `process.execPath`, args `[join(context.extensionPath, "dist", "mcp.mjs"), "--cwd", firstFolder]`, and env `{ ELECTRON_RUN_AS_NODE: "1" }`. The VS Code definition also sets `cwd` to that folder and `version` from the `version` field of `package.json` under `extensionPath`. The Cursor config has no cwd field; `--cwd` is what the script honors on both hosts. `env` is an override, matching the VS Code types and an `mcp.json` env map, not a replacement environment and not a copy of `process.env`.

Alternative considered: command `variant-mcp` from `PATH`. The extension would then do nothing on a machine that only installed the vsix. Rejected.

### Tests add the host APIs they call

`mocks/vscode.ts` gains `cursor.mcp.registerServer` / `unregisterServer`, `lm.registerMcpServerDefinitionProvider`, and a `McpStdioServerDefinition` constructor the test can read back. Existing activation tests call `activate` with no folder and no Cursor API; those functions stay optional so that path does not throw. Manifest test asserts the contribution. A spawn of `mcp-entry.ts` with `--cwd` covers the directory switch and `variant_list` on the tool list. The `variant-mcp` bin field is asserted unchanged.

## Risks / Trade-offs

- [Cursor treats `env` as a full replacement and the child loses `PATH`] → The registered env is the one override. If a host drops the parent environment, that host's call copies `process.env` and sets the override on the copy. The VS Code definition stays an override.
- [`dist/mcp.mjs` is absent until the extension build] → The launch task already builds before F5. The vsix build runs the same esbuild.
- [The child and the extension host are two `variant-api` clients] → Same split as a standalone `variant-mcp` next to the extension today. The child does not open the extension socket.
- [`--cwd` reaches `mcp.ts`] → The entry splices the flag before the import. A test starts the entry with `--cwd` and expects the server to come up.
- [Node in the child resolves `bun:sqlite`] → The bundle externalizes it, as `extension.cjs` does, and the child runs as Node through `ELECTRON_RUN_AS_NODE`.

## Migration Plan

No stored setting and no change to `mcp.json`. Installing the updated extension registers the server on the next activation; an existing `variant` entry in `mcp.json` stays, and the editor can show the extension as another source. Rollback removes the contribution, the register/unregister calls, `mcp-entry.ts`, and the extra esbuild output. The `variant-mcp` bin is untouched, so rollback does not change clients that launch it themselves.
