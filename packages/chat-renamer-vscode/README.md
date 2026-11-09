# Chat Renamer

![Chat Renamer](./media/icon-128.png)

Renames Cursor chats from their first prompt. Runs `caffeinate` to keep awake during agent activity.

**Experimental.** Renaming relies on private Cursor 3.23 internals and borrows the built-in `anysphere.cursor-agent-host` identity for one synchronous call, so it can break on any Cursor update.

## What it does

- `/chat-rename "two words"`, `/chat-rename 'two words'` and `/chat-rename single-word` rename the chat. Cursor's own `/rename-chat` spelling works the same way. Cursor's built-in skill treats the text as a naming hint and spends a model turn; use the `hook` trigger if you want the prompt blocked and the title taken literally.
- **Activation patterns** (`chat-renamer.activationPatterns`, a string array of JavaScript regexes): each line of the first prompt is tested. A match renames the chat to the first capture group, else the whole match. The default list is a path pattern, then a short `_work-` pattern, then a slug pattern. `/vw-spec-iterate @/Users/me/_v-outer/_v-inner` becomes `inner` (the last path segment after its leading prefix token). `/vw-spec-start @_work-my-slug` becomes `my-slug`. `/vw-spec-start my-slug` becomes `my-slug`. An empty array turns patterns off. Invalid entries are skipped and logged.
- **Numbered titles.** A pattern title is numbered against the other open chats only when it has no trailing digits. A typed trailing number is kept: `abc7` beside `abc` stays `abc7`. Otherwise the trailing number is dropped to get the base; if peers share it the title becomes `{base}{max + 1}`: `abc` becomes `abc2`, and with `def3` and `def5` open `def` becomes `def6`. No peers: the title stays as typed. `/chat-rename` titles are literal and never numbered. A chat whose current title already has the requested base (`abc3` for `abc`, any case) is left as it is, for existing chats and for title events alike; the other chats of the group take the smallest numbers it does not hold.
- **Worktree folders.** A prompt such as `/vw-spec-iterate @/path/_v-my-slug`, which is what dragging a worktree folder into the chat produces, renames the chat `my-slug`. With no `chat-renamer.worktreePrefixes`, the default path pattern does that for any leading prefix token, and `/vw-spec-start @_work-my-slug` (no path) becomes `my-slug`. A non-empty prefix list (`_v-`, or e.g. `_work-`; each carries its own connector) replaces the path pattern and also matches that prefix written as `@_work-my-slug`.
- **Existing chats** (`chat-renamer.renameExistingDays`, default `7`, `0` = off): chats created in the last N days that existed before the editor started are renamed too, numbered by creation order (oldest `abc`, then `abc2`, `abc3`), once per chat. Each chat is examined once and remembered, so a title you change by hand later stays. It runs shortly after startup, when the setting changes, and on **Chat Renamer: Rename Existing Chats**, which ignores that memory but obeys the day window. A title event does not start it. Caveats: with the default on, a title you set by hand within the window before the first run is replaced when the chat's first prompt holds a rename request; the numbering covers only the chats inside the window; the chat list can be incomplete right after startup; each chat read costs two `sqlite3` calls. Every log line of this feature starts with `[existing-chats]`, is debug, and names the trigger and the setting (`chat-renamer.renameExistingDays=7`).
- **Awake** (`chat-renamer.awake.when`, `chat-renamer.awake.what`, `chat-renamer.awake.graceDelaySecs`): while a chat is taking a turn or generating, including tool work of that turn, one `caffeinate` process holds the Mac awake. An open, selected, or idle chat does not count. `awake.when` is `chatsActive` (default) or `never`. `awake.what` `screen` (default) runs `caffeinate -disu`; `cpu` runs `caffeinate -dis`. `awake.graceDelaySecs` (default `60`, integer, at least `0`) is how long that process stays after the last turn; `0` stops it immediately. Turning the enable setting off does not turn this off. The owning instance starts it; an idle copy does not.

## Triggers (`chat-renamer.trigger`)

- `titleEvent` (default): listens to `cursor.onDidChangeAgentHostSessionCatalogTitle`. The first title event of a chat is Cursor naming the first prompt; the extension then reads that prompt from Cursor's on-disk store and renames if it holds a request. Only chats created while the editor runs are renamed: the first prompt must be newer than the extension's startup and at most 30 seconds old, so the title events Cursor emits for existing chats at load rename nothing. A prompt that cannot be read (or has no timestamp) leaves the chat alone. Only the first `chat-renamer.titleEventPromptLines` lines of the prompt (default `10`, at least `1`) are tested for a request, so a pattern further down does not rename; the `hook` trigger, **Rename active chat** and existing chats read the whole prompt. Every new chat gets one `[title-event] decision` log line saying whether a slash command or pattern matched (and which pattern), what was decided (`rename`, `keep` or `ignore`) and why.
- `hook`: writes a `beforeSubmitPrompt` hook and script into `.cursor/hooks.json` (`chat-renamer.hookScope`: `workspace` or `user`). The hook sends the prompt and conversation id to this extension's URI handler. A lone slash command is blocked so no model turn is spent; a prompt that only matches a pattern still goes to the model. Needs `python3` and `open` or `xdg-open`. Patterns are copied into the script and evaluated with Python `re`. An unparsable `hooks.json` is never overwritten. Switching the trigger removes the entry and script this extension wrote.

## Commands

- **Chat Renamer: Rename active chat** (`chat-renamer.renameActiveChat`): renames the active chat from its first prompt, including a prompt older than 30 seconds, even when `renameExistingDays` is `0`. Cursor reports every selected chat, not the focused one, so the command takes the selected chat that Cursor's catalog lists as most recently updated (the first selected one when the catalog says nothing), and the most recently updated chat of all when none is selected. No chat at all, or a first prompt with no rename request, leaves the chat alone and tells you why (`no chat found`, `no rename request`, `malformed request` with what is wrong, or the error of a failing rename). At Trace level the log channel shows how the chat was found in `[active-chat]` entries (`selection`, `catalog`, `chosen`), and each run that renames nothing writes an `[active-chat] not renamed` warning with the reason.
- **Chat Renamer: Rename Existing Chats** (`chat-renamer.renameExistingChats`): runs the existing-chats rename now. With `renameExistingDays` at `0` it does nothing and names the setting.

Not shown in the palette; meant for other extensions and scripts:

- `chat-renamer.renameChat(id, title)`
- `chat-renamer.renameChatFromPrompt(id, prompt)`

All activity is logged to the **Chat Renamer** log channel, which **Developer: Show Logs…** lists once the extension has started and which has its own log level. Info shows decisions and renames; select **Trace** in the channel's log level picker to also see the first lines of each new chat's prompt, the title event of a chat that already existed at startup (`[title-event] event`), and the decision that skips it (`before startup`). **Debug** remains the level for a title event after startup. When the first prompt of a new chat cannot be read from Cursor's chat store, Trace shows what the store held (`[title-event] unreadable`, for the first 5 such chats) and the first one also shows a notification. A rename that fails also shows a notification with the cause.

A host extension can supply the same options from elsewhere (Variant reads the `chatRenamer` section of `variants.yaml`); an option you set explicitly in the editor settings wins over the host's value, which wins over the default.

## Development

```bash
bun install
bun run build
bun test
```

Open this package in VS Code and press `F5` to launch the Extension Development Host.
