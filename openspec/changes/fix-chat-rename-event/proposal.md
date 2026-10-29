## Why

A chat created with the first prompt `/vw-spec-start remove-switch` was not renamed. The log showed the title event arrive and then `decision="ignore" reason="no first prompt"`: the renamer could not read the prompt. Current Cursor builds no longer fill the list of message headers in the chat's stored record (`composerData`, `fullConversationHeadersOnly` is empty). They keep the headers in separate rows (`composerConvHeaders`). The renamer reads only the old list, so it finds no first message and gives up after its retries. Every chat on such a build is skipped, by the title event trigger, the existing-chats run and the rename-active-chat command.

## What Changes

- The first prompt of a chat is read from either storage layout of Cursor's chat store: the header rows of the new layout, and the header list of the old layout as fallback.
- A chat whose prompt is readable in either layout is handled the same way as before: same request matching, same age and startup limits, same numbering.
- No change to the `titleEventPromptLines` limit. It applies after the prompt is read and was not involved in this failure.
- No change to when an unreadable prompt is ignored; it is still ignored with reason `no first prompt`.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `chat-renamer/chat-renaming`: adds the requirement that the first prompt is read from both Cursor chat store layouts.

## Impact

- `packages/chat-renamer-api/src/chat-first-prompt.ts` and `chat-first-prompt.spec.ts`.
- Non-goals: a new log line for why a prompt was unreadable, support for chat stores other than Cursor's, raising the retry budget, and changing the title event timing.
