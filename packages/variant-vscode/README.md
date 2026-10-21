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

**Variant: Probe Cursor Chat Commands** (`variant.probeCursorCommands`) lists command ids registered in the current editor that look like a Cursor chat rename or title operation. The list is written to the **Cursor Command Probe** output channel. When nothing matches, the channel shows `No rename-like commands found in this build.`

A listed id is not a stable rename API. Cursor does not document these commands, and a later Cursor release can remove or rename them. This extension does not call a listed command.

Behavior: [specs/variant-vscode/cursor-command-probe](../../openspec/specs/variant-vscode/cursor-command-probe/spec.md).

## Chat renaming

Chat renaming (`/chat-rename`, activation patterns, numbered titles) is provided by [`chat-renamer-vscode`](../chat-renamer-vscode/README.md), which this extension embeds and which also ships on its own. Here its commands use the `variant.` prefix (`variant.renameChat`, `variant.renameChatFromPrompt`) and the `variant.*` settings (`enable`, `trigger`, `hookScope`, `activationPatterns`, `worktreePrefixes`, `renameExistingDays`) plus the palette commands **Variant: Rename active chat** (`variant.renameActiveChat`) and **Variant: Rename Existing Chats** (`variant.renameExistingChats`); `variant.enable` defaults to true and `false` turns chat renaming off, and `renameExistingDays` defaults to 7 and `0` turns renaming of existing chats off. The same options can be set in the `chatRenamer` section of `variants.yaml` (editor settings you set explicitly win), and `variant.prefix` there is the worktree folder prefix the renamer recognises by default (set `chatRenamer.worktreePrefixes` to replace it, `[]` to turn that off and use the default path pattern; `/vw-spec-start @_work-slug` still becomes `slug`). Experimental. Activity is logged to the **Variant Worktrees** output channel.
