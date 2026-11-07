## Purpose

Registers the existing variant MCP server with Cursor or VS Code from the extension, for the open workspace, and leaves the standalone server in place.

## ADDED Requirements

### Requirement: One stdio server for the first workspace folder

When the extension activates with at least one workspace folder and the host offers a registration API, it SHALL register one stdio MCP server named `variant`. The command SHALL be the editor executable. The arguments SHALL be the bundled script `dist/mcp.mjs` inside the extension, then `--cwd`, then the filesystem path of the first workspace folder. The environment override SHALL be `ELECTRON_RUN_AS_NODE` set to `1` and SHALL contain no other variables. A further workspace folder SHALL NOT add another server. Registration SHALL NOT create or edit an `mcp.json` file.

#### Scenario: Cursor receives one server

- **WHEN** the extension activates with workspace folders `/repo` and `/other` and the Cursor registration function exists
- **THEN** that function is called once with name `variant`, command the editor executable, arguments ending in `dist/mcp.mjs`, `--cwd`, and `/repo`, and environment `{ ELECTRON_RUN_AS_NODE: "1" }`

#### Scenario: No configuration file is written

- **WHEN** the extension activates in a workspace that has no `mcp.json`
- **THEN** the server is still registered and no `mcp.json` is created

### Requirement: Cursor is the only registration on Cursor

When `vscode.cursor.mcp.registerServer` is a function, the extension SHALL register with that function and SHALL NOT call `vscode.lm.registerMcpServerDefinitionProvider`. When that Cursor registration happened, deactivation SHALL call `vscode.cursor.mcp.unregisterServer` with `variant`.

#### Scenario: Cursor skips the VS Code provider

- **WHEN** the extension activates with a workspace folder and `vscode.cursor.mcp.registerServer` is a function
- **THEN** `registerServer` is called once and `registerMcpServerDefinitionProvider` is not called

#### Scenario: Deactivate drops the Cursor server

- **WHEN** the extension registered the Cursor server and then deactivates
- **THEN** `unregisterServer` is called with `variant`

### Requirement: VS Code provider when Cursor's API is absent

When `vscode.cursor.mcp.registerServer` is not a function and `vscode.lm.registerMcpServerDefinitionProvider` is a function, the extension SHALL register provider id `variant` and SHALL NOT call `registerServer`. The contribution `mcpServerDefinitionProviders` SHALL include id `variant` with label `Variant Worktrees`. The provider SHALL return one stdio definition labeled `variant`, with the command, arguments, and environment of the server above, with cwd the first workspace folder, and with version equal to the extension version.

#### Scenario: Provider returns the workspace server

- **WHEN** the extension activates with workspace folder `/repo`, the Cursor registration function is absent, and the VS Code provider function exists
- **THEN** provider id `variant` is registered, `registerServer` is not called, and the definition is labeled `variant`, uses cwd `/repo`, uses the same command, arguments, and environment, and carries the extension version

#### Scenario: Contribution id matches the provider

- **WHEN** the extension manifest is read
- **THEN** `mcpServerDefinitionProviders` contains id `variant` and label `Variant Worktrees`

### Requirement: Activation succeeds when there is nothing to register

When no workspace folder is open, the extension SHALL NOT call either registration function. When a workspace folder is open and neither registration function exists, the extension SHALL NOT throw. In both cases activation SHALL succeed.

#### Scenario: No folder

- **WHEN** the extension activates with no workspace folder
- **THEN** neither registration function is called and activation succeeds

#### Scenario: Host has neither API

- **WHEN** the extension activates with a workspace folder and neither registration function exists
- **THEN** activation succeeds and does not throw

### Requirement: The bundled script is the existing server

The bundled script SHALL, when given `--cwd <directory>`, make `<directory>` its working directory, remove that flag from the arguments, and start the same stdio server as the `variant-mcp` bin. Without `--cwd` it SHALL leave the working directory unchanged. The `variant-mcp` package bin SHALL remain `variant-mcp` and SHALL still start that server with no required extra arguments. A tools list from the bundled script SHALL include `variant_list` and SHALL NOT include `variant_destroy`.

#### Scenario: Working directory flag

- **WHEN** the bundled script starts with `--cwd` set to a directory that contains `variants.yaml`
- **THEN** the server loads that directory's configuration, its tools list includes `variant_list`, and its tools list has no `variant_destroy`

#### Scenario: Standalone launch is unchanged

- **WHEN** the `variant-mcp` package is inspected and the bin is started with no extra arguments
- **THEN** the bin is `variant-mcp` and the server still starts from the process working directory
