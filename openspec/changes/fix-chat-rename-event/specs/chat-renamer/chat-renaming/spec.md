## ADDED Requirements

### Requirement: The first prompt is read from either Cursor chat store layout

The renamer SHALL read a chat's first prompt, with its submit time, from Cursor's on-disk chat store in whichever layout the installed Cursor writes. In the newer layout the message headers of a chat sit in their own rows and the chat's record lists none. In the older layout the record lists them. The renamer SHALL try the newer layout first and SHALL always fall back to the older layout, the method that worked before: a newer-layout read that finds no human message, fails, or returns output the renamer cannot parse SHALL NOT end the read, and the older layout SHALL then be tried. A method that worked in an earlier version SHALL NOT be removed when another is added. The renamer SHALL take the first human message of the first layout that holds one as the first prompt. This SHALL hold for every trigger that reads a first prompt: the title event, the existing-chats run, and the command that renames the active chat. A chat whose store holds no human message in any layout SHALL still count as having an unreadable first prompt.

#### Scenario: Newer layout

- **WHEN** a chat's record lists no message headers and its header rows hold a human message with the text `/vw-spec-start abc`
- **THEN** its first prompt is `/vw-spec-start abc` with the submit time of that message

#### Scenario: Older layout

- **WHEN** a chat has no header rows and its record lists a human message with the text `/vw-spec-start abc`
- **THEN** its first prompt is `/vw-spec-start abc` with the submit time of that message

#### Scenario: Newer layout wins

- **WHEN** a chat has header rows with a human message and its record also lists a human message
- **THEN** its first prompt is the first human message of the header rows

#### Scenario: Newer layout fails

- **WHEN** reading the header rows of a chat fails, and its record lists a human message with the text `/vw-spec-start abc`
- **THEN** its first prompt is `/vw-spec-start abc`

#### Scenario: No human message

- **WHEN** no layout holds a human message for a chat
- **THEN** its first prompt is unreadable and the chat is not renamed

### Requirement: An unreadable first prompt of a new chat is diagnosed and announced

When the title event trigger ignores a chat because its first prompt cannot be read or has no timestamp (reason `no first prompt`), the renamer SHALL treat it as a problem with Cursor's internals. For each of the first 5 such chats since the extension started, the renamer SHALL write one entry at `trace` level, in category `title-event`, with message `unreadable` and the fields `session` (the chat id), `attempt` (1 to 5), `record` (the version of the chat's stored record, or `missing` when there is none), `listedHeaders` (the number of message headers listed in that record), `headerRows` (the number of header rows of the newer layout), and `error` (the message of a failed read, left out when none failed). For the first such chat since the extension started, the renamer SHALL also show one warning notification that names the chat, says that Cursor's chat store could not be read and that Cursor may have changed it, and points to the log. Later chats SHALL NOT show a notification and the sixth and later SHALL NOT write the `unreadable` entry. Collecting this information SHALL NOT change whether a chat is renamed, SHALL NOT add an entry above `trace`, and a failure while collecting it SHALL NOT throw. A chat ignored for any other reason SHALL NOT count.

#### Scenario: First unreadable chat

- **WHEN** the first prompt of the first new chat since the extension started cannot be read
- **THEN** the log has a `trace` entry `[title-event] unreadable session="…" attempt=1` with the `record`, `listedHeaders` and `headerRows` fields
- **AND** one warning notification names the chat

#### Scenario: Second unreadable chat

- **WHEN** the first prompt of a second new chat cannot be read
- **THEN** the log has a `trace` entry with `attempt=2`
- **AND** no further notification is shown

#### Scenario: Sixth unreadable chat

- **WHEN** the first prompts of 6 new chats since the extension started cannot be read
- **THEN** the log has 5 `unreadable` entries, for the first 5 chats
- **AND** the sixth chat has only its `decision` entry

#### Scenario: Another reason to ignore

- **WHEN** a chat is ignored because its prompt holds no rename request
- **THEN** no `unreadable` entry is written and no notification is shown

#### Scenario: Readable chat after an unreadable one

- **WHEN** a chat's first prompt was unreadable and a later chat's is readable and holds a rename request
- **THEN** the later chat is renamed as usual
