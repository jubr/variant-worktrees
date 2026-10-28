## Why

When a chat does not get renamed, the log gives no way to tell whether Cursor sent a title event at all. The log only holds a decision line, and only for the first title event of each chat. A later event, such as a rename by hand or by the agent, is dropped without a trace. Support has to guess whether the event never came or the renamer ignored it.

## What Changes

- Every catalog title event Cursor delivers (`onDidChangeAgentHostSessionCatalogTitle`) is logged the moment it arrives, at `debug` level in category `title-event`, with the chat id and the new title when there is one.
- The line is written before any skip logic, so later events of an already-checked chat are logged too.
- No change to when a chat is renamed, to the decision line, or to the default log level output.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `chat-renamer/chat-renaming`: adds the requirement that each title event is logged on arrival at `debug` level.

## Impact

- `packages/chat-renamer-vscode/src/trigger.ts` and `trigger.test.ts`.
- The log channel gains lines only when its level is set to Debug. Non-goals: logging the prompt, logging events of the existing-chats listener, or a new setting.
