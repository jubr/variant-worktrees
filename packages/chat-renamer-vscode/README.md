# Chat Renamer

Renames Cursor chats from their first prompt. Single purpose: it does nothing else.

**Experimental.** It relies on private Cursor 3.23 internals and borrows the built-in `anysphere.cursor-agent-host` identity for one synchronous call, so it can break on any Cursor update.

## What it does

- `/chat-rename "two words"`, `/chat-rename 'two words'` and `/chat-rename single-word` rename the chat. Cursor's own `/rename-chat` spelling works the same way. Cursor's built-in skill treats the text as a naming hint and spends a model turn; use the `hook` trigger if you want the prompt blocked and the title taken literally.
- **Activation patterns** (`chat-renamer.activationPatterns`, a string array of JavaScript regexes): each line of the first prompt is tested. A match renames the chat to the first capture group, else the whole match. The default `/[a-z]+-spec-[a-z]+\s+([A-Za-z0-9_-]+)` turns `/vw-spec-start my-slug` into the title `my-slug`. An empty array turns patterns off. Invalid entries are skipped and logged.
- **Numbered titles.** A pattern title is numbered against the other open chats. The trailing number is dropped to get the base; if peers share it the title becomes `{base}{max + 1}`: `abc` becomes `abc2`, and with `def3` and `def5` open `def` becomes `def6`. No peers: the title stays as typed. `/chat-rename` titles are literal and never numbered.

## Triggers (`chat-renamer.trigger`)

- `titleEvent` (default): listens to `cursor.onDidChangeAgentHostSessionCatalogTitle`. The first title event of a chat is Cursor naming the first prompt; the extension then reads that prompt from Cursor's on-disk store and renames if it holds a request. Only chats created while the editor runs are renamed: the first prompt must be newer than the extension's startup and at most 30 seconds old, so the title events Cursor emits for existing chats at load rename nothing. A prompt that cannot be read (or has no timestamp) leaves the chat alone.
- `hook`: writes a `beforeSubmitPrompt` hook and script into `.cursor/hooks.json` (`chat-renamer.hookScope`: `workspace` or `user`). The hook sends the prompt and conversation id to this extension's URI handler. A lone slash command is blocked so no model turn is spent; a prompt that only matches a pattern still goes to the model. Needs `python3` and `open` or `xdg-open`. Patterns are copied into the script and evaluated with Python `re`. An unparsable `hooks.json` is never overwritten. Switching the trigger removes the entry and script this extension wrote.

## Commands

Not shown in the palette; meant for other extensions and scripts.

- `chat-renamer.renameChat(id, title)`
- `chat-renamer.renameChatFromPrompt(id, prompt)`

All activity is logged to the **Chat Renamer** output channel.

## Using it inside another extension

Import `registerChatRenamer` from `chat-renamer-vscode` in `activate`:

```ts
import { registerChatRenamer } from "chat-renamer-vscode";

registerChatRenamer(context, {
  commandPrefix: "my-ext", // commands: my-ext.renameChat, my-ext.renameChatFromPrompt
  configSection: "my-ext.chatRename", // settings: trigger, hookScope, activationPatterns
  log, // optional Logger; default is a "Chat Renamer" channel
});
```

The host manifest must contribute the three settings under `configSection` and list `onStartupFinished` and `onUri` as activation events. The editor-independent logic lives in the `chat-renamer-api` package.

If this extension and a host that embeds it are both installed in one window, only the one that starts first runs the triggers (title listener, hook, URI handler). The other logs which extension owns renaming, removes any hook script it wrote earlier, and stays idle; its commands still work. Ownership passes on when the owner is disposed.

## Development

```bash
bun install
bun run build
bun test
```

Open this package in VS Code and press `F5` to launch the Extension Development Host.
