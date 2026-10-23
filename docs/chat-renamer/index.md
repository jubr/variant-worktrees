# Chat Renamer

Renames the Cursor chat from its first prompt. `variant-vscode` embeds it. If the standalone Chat Renamer extension is installed in the same window, `variant-vscode` owns renaming and the standalone copy stays idle.

## Slash command

`/chat-rename my-title` sets that title. `/chat-rename "two words"` and `/rename-chat` do the same. A slash-command title is literal and is not numbered.

## Activation patterns

Each line of the first prompt is tested against `chatRenamer.activationPatterns`. A match renames the chat to the first capture group, or to the whole match when there is no group. An empty list turns patterns off.

With the defaults:

- `/vw-spec-start my-slug` becomes `my-slug`
- `/vw-spec-start @_work-my-slug` becomes `my-slug`
- `/vw-spec-iterate @/path/_v-my-slug` (a worktree folder dragged into the chat) becomes `my-slug`

`variant.prefix` (default `_v-`) is the worktree-folder prefix those paths use. Set `chatRenamer.worktreePrefixes` to replace it. An empty list turns that path derivation off; `/vw-spec-start @_work-my-slug` still becomes `my-slug`.

A pattern title with no trailing digits is numbered against the other open chats that share its base: `abc` becomes `abc2` when `abc` is already open. A title you type with trailing digits, such as `abc7`, stays `abc7`. A chat whose current title already has that base is left as it is.

## Existing chats

`chatRenamer.renameExistingDays` (default `7`, `0` turns it off) also renames chats created in that window before the editor started. Numbering follows creation order. Each chat is examined once, so a title you change by hand later stays. **Variant: Rename Existing Chats** runs that pass again and ignores the memory, still inside the day window.

## Triggers

`chatRenamer.trigger` is `titleEvent` by default: the first title Cursor assigns while the editor is running is checked, and the prompt must be at most 30 seconds old. Only its first `chatRenamer.titleEventPromptLines` lines (default `10`) are tested for a request; the other triggers and the palette commands read the whole prompt. `hook` writes a `beforeSubmitPrompt` hook (`chatRenamer.hookScope`: `workspace` or `user`) so a lone slash command is blocked and the title is taken literally. A prompt that only matches a pattern still goes to the model.

Options live in [Configuration](./configuration). Editor settings you set explicitly win over `variants.yaml`.

Palette commands: **Variant: Rename active chat** and **Variant: Rename Existing Chats**. Activity is logged to the **Variant Worktrees** log channel, which **Developer: Show Logs…** lists. The first prompt lines the title event read appear at Trace level, and each new chat gets one `[title-event] decision` line (matched or not, which pattern, rename/keep/ignore, and why). A rename that fails shows a notification with the cause.
