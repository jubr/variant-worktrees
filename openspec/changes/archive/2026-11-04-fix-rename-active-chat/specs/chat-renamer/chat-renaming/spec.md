## MODIFIED Requirements

### Requirement: Rename the active chat on command

The standalone extension SHALL contribute command `chat-renamer.renameActiveChat` with palette title `Chat Renamer: Rename active chat`. When embedded in Variant, the command SHALL be `variant.renameActiveChat` with palette title `Variant: Rename active chat`. Running it SHALL rename the active chat, using that chat's first prompt and the same request, numbering, and same-base rules as a title event. It SHALL NOT apply the limit that a chat must have been created while the editor runs, and it SHALL NOT apply the 30-second age limit. It SHALL run when `renameExistingDays` is 0. When no chat can be found, or the first prompt holds no rename request, the command SHALL NOT rename and SHALL tell the user. The command SHALL stay registered while the instance is idle.

The active chat SHALL be chosen from the chats Cursor reports as selected. Ids that are plain strings, and objects that carry the id in a `composerId`, `sessionId` or `id` field, SHALL count; anything else SHALL be ignored. When several chats are selected, the one that Cursor's session catalog lists with the newest `updatedAt` SHALL be the active chat; the first selected id SHALL win a tie and SHALL be used when the catalog lists none of them. When Cursor reports no selected chat, the chat the catalog lists with the newest `updatedAt` SHALL be the active chat. Only when there is no selected chat and the catalog lists no chats SHALL the command report that no chat was found.

#### Scenario: Active chat with an old pattern prompt

- **WHEN** the selected chat's first prompt is `/vw-spec-start abc` and that prompt is older than 30 seconds
- **THEN** the chat is renamed `abc`

#### Scenario: No rename request

- **WHEN** the selected chat's first prompt is `fix the build`
- **THEN** the chat is not renamed and the user is told

#### Scenario: Several selected chats

- **WHEN** Cursor reports selected chats `pane-chat` and `editor-chat`, and the catalog lists `editor-chat` as updated more recently than `pane-chat`
- **THEN** `editor-chat` is the active chat and is examined for a rename request

#### Scenario: Selected chat the catalog does not list

- **WHEN** Cursor reports selected chats `first` and `second`, and the catalog lists neither
- **THEN** `first` is the active chat

#### Scenario: Selected ids as objects

- **WHEN** Cursor reports a selected chat as an object `{ composerId: "chat-1" }`
- **THEN** `chat-1` is the active chat

#### Scenario: No selected chat falls back to the newest chat

- **WHEN** Cursor reports no selected chat and the catalog lists `old` updated earlier than `recent`
- **THEN** `recent` is the active chat and is examined for a rename request

#### Scenario: No selected chat

- **WHEN** no chat is selected and the catalog lists no chats
- **THEN** no chat is renamed and the user is told

#### Scenario: Palette titles

- **WHEN** the standalone extension and Variant each contribute the command
- **THEN** the palette shows `Chat Renamer: Rename active chat` and `Variant: Rename active chat`

## ADDED Requirements

### Requirement: Rename active chat explains itself in the log

Running the active-chat command SHALL write log entries in category `active-chat`. At `trace` level it SHALL log, in this order: the selection Cursor returned (message `selection`, fields `type` naming the shape of the value, `count`, and `ids` with the ids that counted), the catalog (message `catalog`, fields `count` with the number of chats the catalog lists, and `chats` listing `id`, `title` and `updatedAt` for each chat that took part in the choice: the selected chats the catalog lists, or the newest chat when nothing is selected), and the choice (message `chosen`, fields `session` and `rule`, where `rule` is `newest selected`, `first selected`, `newest in catalog` or `none`). The first prompt lookup and decision SHALL be logged the way a title event does. When the command renames nothing it SHALL also write one `warn` entry, message `not renamed`, with the field `reason` holding the text shown to the user (`no chat found`, or the decision `reason` with its `detail`), so the log explains a command that returned `false`. A successful rename SHALL keep its `rename <chat id>: <reason>; title <json title>` line. A catalog that cannot be read SHALL NOT stop the command: the entry `catalog` SHALL then have `count=0` and a `warn` entry SHALL carry the failure.

#### Scenario: Trace shows how the chat was found

- **WHEN** the command runs at trace level with selected ids `a` and `b` and the catalog lists `b` as the newer
- **THEN** the log has `[active-chat] selection` with `count=2`, a `[active-chat] catalog` entry listing both chats, and `[active-chat] chosen session="b" rule="newest selected"`

#### Scenario: Nothing selected

- **WHEN** Cursor returns an empty list and the catalog lists no chats
- **THEN** the log has `[active-chat] selection` with `count=0`, `[active-chat] chosen rule="none"`, and a `warn` entry `[active-chat] not renamed reason="no chat found"`

#### Scenario: Prompt holds no request

- **WHEN** the active chat's first prompt is `fix the build`
- **THEN** the log has a `warn` entry `[active-chat] not renamed reason="no rename request"`

#### Scenario: Catalog fails

- **WHEN** reading the catalog throws while two chats are selected
- **THEN** the first selected chat is the active chat, `[active-chat] catalog` has `count=0`, and a `warn` entry names the failure

#### Scenario: Default log level

- **WHEN** the log channel level is `info`
- **THEN** no `[active-chat] selection`, `catalog` or `chosen` entry is shown
