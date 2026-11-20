## Why

The Commands page mixes the commands of a variant, the commands of a project and the commands of the executable (`ui`, `mcp`, `completions`) under two headings, and `mcp` and `completions` live on the CLI page under unrelated names. Headings are bare words (`### create`), so links read as `[create](./commands#create)` and say nothing about the command line. The Configuration page runs its options together.

## What Changes

- **Command sections in code.** Every command carries `section: basic | lifecycle | cli`. `init`, `config`, `list`, `status` are `basic`; `create`, `provision`, `up`, `watch`, `down`, `deprovision`, `implode` are `lifecycle`; `ui`, `mcp`, `completions` are `cli`. The docs test reads these tags, so a new command must be documented under its section.
- **Commands page.** Two sections in this order: *Basic commands* (`init`, `config`, `list`, `status`) and *Lifecycle commands*. The intro is rewritten. Command headings read ``### `variant create` `` (id `variant-create`). `ui` leaves the page.
- **CLI page.** Gains *Basic commands* and *Lifecycle commands*, each only a list of deep links into Commands, and, last, *CLI-only commands* with ``### `variant mcp` ``, ``### `variant ui` `` and ``### `variant completions` ``. The `MCP server` and `Completions` sections move there and `ui` moves over from Commands. A test pins this heading structure and every deep link.
- **Links.** Every link to a command reads ``[`variant create`](./commands#variant-create)``, including links inside the Commands and CLI pages, the Overview, the MCP, Extension and library pages, and the Configuration page.
- **Configuration.** Each option heading is preceded by a horizontal rule with less vertical space around it than a regular rule.
- **BREAKING (docs URLs):** `commands#create` and the other bare anchors, `cli#mcp-server`, `cli#completions` stop resolving. All internal links are updated; external links to the old anchors break.

## Capabilities

### New Capabilities

### Modified Capabilities

- `docs/site`: Commands has three sections and prefixed headings; the CLI page lists the commands and holds the CLI-only ones; command links use the full label; Configuration separates its options with a rule; Overview and MCP-tool links use the new anchors.
- `variant-api/commands`: `CommandDefinition` carries `section`; the CLI-only commands carry `cli`.

## Impact

- `packages/variant-api/src/commands.ts` (+ spec), `packages/variant-cli/src/commands/index.ts`.
- `docs/guide/commands.md`, `cli.md`, `configuration.md`, `overview.md`, `installation.md`, `runtime.md`, `workspace.md`, `docs/vscode/mcp.md`, `extension.md`, `docs/development/library.md`, `docs/.vitepress/theme/custom.css`.
- `scripts/docs-coverage.spec.ts`, `scripts/docs-site.spec.ts`; `README.md` and `CONTRIBUTING.md` where they name the docs sections or anchors; `CHANGELOG.md`.
