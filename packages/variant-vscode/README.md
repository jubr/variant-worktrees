# Variant VS Code

VS Code extension package for Variant, scaffolded from the
[Bun VS Code extension template](https://github.com/lalunamel/bun-vscode-extension).

## Development

```bash
bun install
bun run build
bun test
```

Open this package in VS Code and press `F5` to launch the Extension Development Host.

## Cursor command probe

**Variant: Probe Cursor Chat Commands** (`variant-worktrees.probeCursorCommands`) lists command ids registered in the current editor that look like a Cursor chat rename or title operation. The list is written to the **Cursor Command Probe** output channel. When nothing matches, the channel shows `No rename-like commands found in this build.`

A listed id is not a stable rename API. Cursor does not document these commands, and a later Cursor release can remove or rename them. This extension does not call a listed command.

Behavior: [specs/variant-vscode/cursor-command-probe](../../openspec/specs/variant-vscode/cursor-command-probe/spec.md).

## Chat renaming

Chat renaming (`/chat-rename`, activation patterns, numbered titles) is provided by [`chat-renamer-vscode`](../chat-renamer-vscode/README.md), which this extension embeds and which also ships on its own. Here it keeps the `variant-worktrees.` command prefix and the `variant-worktrees.chatRename.*` settings (`trigger`, `hookScope`, `activationPatterns`). Not part of the OpenSpec change; experimental. Activity is logged to the **Variant Worktrees** output channel.
