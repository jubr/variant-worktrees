## ADDED Requirements

### Requirement: The first prompt is read from either Cursor chat store layout

The renamer SHALL read a chat's first prompt, with its submit time, from Cursor's on-disk chat store in whichever layout the installed Cursor writes. In the newer layout the message headers of a chat sit in their own rows and the chat's record lists none. In the older layout the record lists them. The renamer SHALL use the headers of the newer layout when it finds any, and otherwise the list of the older layout. It SHALL take the first human message of the chosen headers as the first prompt. This SHALL hold for every trigger that reads a first prompt: the title event, the existing-chats run, and the command that renames the active chat. A chat whose store holds no human message in either layout SHALL still count as having an unreadable first prompt.

#### Scenario: Newer layout

- **WHEN** a chat's record lists no message headers and its header rows hold a human message with the text `/vw-spec-start abc`
- **THEN** its first prompt is `/vw-spec-start abc` with the submit time of that message

#### Scenario: Older layout

- **WHEN** a chat has no header rows and its record lists a human message with the text `/vw-spec-start abc`
- **THEN** its first prompt is `/vw-spec-start abc` with the submit time of that message

#### Scenario: Newer layout wins

- **WHEN** a chat has header rows with a human message and its record also lists a human message
- **THEN** its first prompt is the first human message of the header rows

#### Scenario: No human message

- **WHEN** neither layout holds a human message for a chat
- **THEN** its first prompt is unreadable and the chat is not renamed
