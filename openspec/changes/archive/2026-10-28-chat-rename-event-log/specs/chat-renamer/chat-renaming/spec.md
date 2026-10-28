## ADDED Requirements

### Requirement: Every title event is logged on arrival

When the title event trigger is active, the renamer SHALL write one log entry for each catalog title event Cursor delivers, at `debug` level, in category `title-event`, with message `event` and the fields `session` (the chat id) and `title` (the new title, left out when the event carries none). The entry SHALL be written when the event arrives, before the renamer decides anything, so it SHALL also be written for later events of a chat whose first event was already handled. Writing the entry SHALL NOT change whether a chat is renamed and SHALL NOT add an entry at a level above `debug`.

#### Scenario: First event of a chat

- **WHEN** Cursor delivers a title event for chat `fresh` with title `Some AI title`
- **THEN** the log has a `debug` entry `[title-event] event session="fresh" title="Some AI title"`

#### Scenario: Later event of the same chat

- **WHEN** Cursor delivers a second title event for chat `fresh` with title `Renamed by hand`
- **THEN** the log has a `debug` entry `[title-event] event session="fresh" title="Renamed by hand"`
- **AND** the chat is not examined for a rename request again

#### Scenario: Event without a title

- **WHEN** Cursor delivers a title event for chat `other` with no title
- **THEN** the log has a `debug` entry `[title-event] event session="other"`

#### Scenario: Default log level

- **WHEN** the log channel level is `info`
- **THEN** no `[title-event] event` entry is shown
