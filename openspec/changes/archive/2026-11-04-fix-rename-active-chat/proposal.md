## Why

`Rename active chat` often does nothing: the Variant Worktrees log shows `renameActiveChat() -> false` with no hint why, and the user is told the chat is not selected or was not renamed even though they are looking at it. The command takes the first id of Cursor's `composer.getOrderedSelectedComposerIds`, which lists every selected chat, panes before editor tabs, so it is not the chat the user is working in. When the list is empty or holds other chats, the command acts on the wrong chat or none. Nothing in the log says which ids Cursor returned, so the cause cannot be seen.

## What Changes

- `renameActiveChat` logs how it found the chat at trace level under category `active-chat`: the raw result of `composer.getOrderedSelectedComposerIds` (shape and ids), the catalog size, each candidate with its catalog title and `updatedAt`, the chat chosen and the rule that chose it, the first prompt lookup, and the decision.
- Every outcome of `renameActiveChat` that renames nothing is logged at warn level with the reason, next to the notification the user sees, so `renameActiveChat() -> false` always has a cause in the log.
- The active chat is chosen better. Among the selected chats the one Cursor's catalog lists as most recently updated wins; the first selected id breaks ties and covers chats the catalog does not list. When Cursor reports no selected chat, the most recently updated chat in the catalog is used instead of giving up. Ids that arrive as objects with a chat id field are accepted next to plain strings.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `chat-renamer/chat-renaming`: the requirement `Rename the active chat on command` defines how the active chat is chosen and what the command logs; the `no selected chat` scenario changes because a recently updated chat now serves as fallback.

## Impact

- `packages/chat-renamer-vscode/src/commands.ts` (active-chat resolution and logging), `packages/chat-renamer-vscode/src/trigger.test.ts` (tests), and docs/READMEs that describe the command (`packages/chat-renamer-vscode/README.md`, `docs/chat-renamer/index.md`).
- No new settings, commands, or dependencies. Both the standalone Chat Renamer and the Variant host are affected through the shared command code.
