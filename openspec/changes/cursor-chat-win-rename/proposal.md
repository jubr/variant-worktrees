## Why

Cursor agent chat tabs are proprietary webview UI. The public VS Code extension API does not expose a stable way to rename them, and internal command ids change between Cursor releases. Variant needs an honest, in-editor probe that reports whether the running Cursor build registers any rename-like internal commands, without pretending those commands are a supported rename API.

## What Changes

- Add a Variant VS Code command that enumerates commands registered in the current editor and lists those whose ids match both a Cursor chat family (`cursor`, `composer`, `aichat`, `agent`) and a title-like verb (`rename`, `title`, `label`).
- Show the match list, or an explicit empty result, in a dedicated output channel.
- Document that any discovered command is reverse-engineered and version-fragile. The extension does not call it.

## Capabilities

### New Capabilities

- `variant-vscode/cursor-command-probe`: read-only discovery of Cursor-internal commands that look related to chat title or rename, reported in an output channel.

### Modified Capabilities

<!-- None. Existing variant-api, variant-config, and variant-mcp requirements stay unchanged. -->

## Impact

- `packages/variant-vscode`: new contributed command, activation event, output channel, and colocated tests. Hello World stays.
- No new runtime dependencies. Uses `vscode.commands.getCommands` and `vscode.window.createOutputChannel`.
- No CLI, MCP, or database behavior change.
- User-facing note belongs in the extension README, not in VitePress library docs.

## Non-goals

- Renaming a Cursor chat tab, composer session, or agent transcript.
- Executing any discovered internal command, including with a chat id and a new title.
- A public, documented, or cross-version contract for Cursor chat titles.
- Restoring or replacing Cursor's own right-click rename UI.
- A standalone POC extension or a command id outside the `variant-vscode.*` namespace.

## Assumptions

- The probe ships inside the existing `variant-vscode` extension. Command id is `variant-vscode.probeCursorCommands`. The illustrative `poc.probeCursorCommands` id is not used.
- "This build" means the editor process that loaded the extension. The probe does not query Cursor's cloud, forum, or release notes.
