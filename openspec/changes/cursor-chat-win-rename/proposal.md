## Why

Cursor agent chat tabs are proprietary webview UI. The public VS Code extension API does not expose a stable way to rename them, and internal command ids change between Cursor releases. Variant needs an honest, in-editor probe that reports whether the running Cursor build registers any rename-like internal commands, without pretending those commands are a supported rename API.

## What Changes

- Add a Variant VS Code command that enumerates commands registered in the current editor and lists those whose ids match both a Cursor chat family (`cursor`, `composer`, `aichat`, `agent`) and a title-like verb (`rename`, `title`, `label`).
- Show the match list, or an explicit empty result, in a dedicated output channel.
- Document that any discovered command is reverse-engineered and version-fragile. The extension does not call it.
- Add an experimental chat renamer, extracted into `chat-renamer-api` (editor-independent logic) and `chat-renamer-vscode` (a single-purpose extension that Variant also embeds). It renames a Cursor chat from its first prompt: `/chat-rename` and `/rename-chat` commands plus user-editable activation patterns, with numbered titles so open chats stay distinct.
- The title-event trigger reacts only to chats created while the editor is running, and only one renamer instance acts when more than one extension embeds it.
- A setting `renameExistingDays` (default 7, 0 = off) also renames chats created in the last N days that existed before the editor started, numbering each group of same-titled chats by creation order (oldest keeps the plain title, the next gets 2, then 3), once per chat, plus a command to run it on demand. Every run logs which trigger started it and the setting it obeys.
- A new package `chat-renamer-config` holds the renamer's defaults and Zod field schemas (worktree prefix, activation patterns, days window) so `chat-renamer-api` and `variant-config` share one definition.
- A prompt that drags in a worktree folder (`/vw-spec-iterate @/path/_v-my-slug`) derives `my-slug`. The worktree prefix (`_v`, or e.g. `_work`) is a new `variant.worktreePrefix` setting in `variants.yaml`, which `variant-api` also uses when it creates worktrees.

## Capabilities

### New Capabilities

- `variant-vscode/cursor-command-probe`: read-only discovery of Cursor-internal commands that look related to chat title or rename, reported in an output channel.
- `chat-renamer-config/defaults`: the renamer's default values and field schemas, shared by the renamer and `variant-config`.
- `variant-config` (extended): `variant.worktreePrefix`, validated by the shared schema.
- `variant-api/core` (extended): worktrees are named with the configured prefix.
- `chat-renamer-api/chat-rename-requests`: how a prompt becomes a chat title: slash commands, activation patterns, and title numbering.
- `chat-renamer-vscode/chat-renaming`: when the extension renames: triggers, realtime-only behavior, single active instance, settings, and embedding.

### Modified Capabilities

<!-- None. Existing variant-api, variant-config, and variant-mcp requirements stay unchanged. -->

## Impact

- `packages/variant-vscode`: new contributed command, activation event, output channel, and colocated tests. Hello World stays.
- No new runtime dependencies. Uses `vscode.commands.getCommands` and `vscode.window.createOutputChannel`.
- New packages `packages/chat-renamer-config`, `packages/chat-renamer-api` and `packages/chat-renamer-vscode`; `variant-vscode` depends on the latter and keeps its `variant-worktrees.*` command prefix and `variant-worktrees.chatRename.*` settings.
- The renamer uses private Cursor 3.23 internals (`cursor.projectAgentHostSessionTitle`, the agent-host catalog, Cursor's on-disk chat store) and borrows the built-in `anysphere.cursor-agent-host` extension identity for the duration of one synchronous call. It can break on any Cursor update.
- No CLI, MCP, or database behavior change.
- User-facing note belongs in the extension README, not in VitePress library docs.

## Non-goals

- The probe renaming a Cursor chat or executing any discovered internal command. The probe stays read-only; the renamer is a separate capability and does not execute probe hits.
- A public, documented, or cross-version contract for Cursor chat titles.
- Restoring or replacing Cursor's own right-click rename UI.
- A command id outside the `variant-worktrees.*` namespace in `variant-vscode`. The standalone renamer uses `chat-renamer.*`.
- Renaming in several windows at once.
- Renaming chats that cannot be listed (archived, subagent, background) or whose first prompt cannot be read.
- Marketplace publication of the standalone renamer.

## Assumptions

- The probe ships inside the existing `variant-vscode` extension. Command id is `variant-worktrees.probeCursorCommands`. The illustrative `poc.probeCursorCommands` id is not used.
- "This build" means the editor process that loaded the extension. The probe does not query Cursor's cloud, forum, or release notes.
