## MODIFIED Requirements

### Requirement: Every title event is logged on arrival

When the title event trigger is active, the renamer SHALL write one log entry for each catalog title event Cursor delivers, in category `title-event`, with message `event` and the fields `session` (the chat id) and `title` (the new title, left out when the event carries none). The level SHALL be `trace` when the chat's first prompt was submitted before the renamer started listening, and `debug` for every other event: a chat created after startup, a chat whose first prompt cannot be read or has no timestamp, and a later event of a chat whose first event was already handled. The `trace` entry SHALL be the only `event` entry for that startup chat, written once the prompt time is known and before any rename. Every other `event` entry SHALL be written when the event arrives, before the renamer decides anything. Writing the entry SHALL NOT change whether a chat is renamed and SHALL NOT add an entry at a level above `debug`.

#### Scenario: First event of a chat

- **WHEN** Cursor delivers a title event for chat `fresh` with title `Some AI title` and that chat's first prompt was submitted after the renamer started listening
- **THEN** the log has a `debug` entry `[title-event] event session="fresh" title="Some AI title"`

#### Scenario: Existing chat at editor load

- **WHEN** Cursor delivers a title event for chat `old` with title `Variant worktrees setup` and that chat's first prompt was submitted before the renamer started listening
- **THEN** the log has a `trace` entry `[title-event] event session="old" title="Variant worktrees setup"`
- **AND** it has no `debug` entry for that event

#### Scenario: Later event of the same chat

- **WHEN** Cursor delivers a second title event for chat `fresh` with title `Renamed by hand`
- **THEN** the log has a `debug` entry `[title-event] event session="fresh" title="Renamed by hand"`
- **AND** the chat is not examined for a rename request again

#### Scenario: Event without a title

- **WHEN** Cursor delivers a title event for chat `other` with no title and that chat was created after the renamer started listening
- **THEN** the log has a `debug` entry `[title-event] event session="other"`

#### Scenario: Default log level

- **WHEN** the log channel level is `info`
- **THEN** no `[title-event] event` entry is shown

#### Scenario: Debug hides the startup event

- **WHEN** the log channel level is `debug` and Cursor delivers a title event for a chat that existed before the renamer started listening
- **THEN** that `event` entry is not shown
- **AND** a `debug` `event` entry for a chat created after startup is shown

## ADDED Requirements

### Requirement: A before-startup decision is logged at trace

When the title event trigger ignores a chat because its first prompt was submitted before the renamer started listening, the renamer SHALL write that decision at `trace` level, in category `title-event`, with message `decision`, `decision="ignore"` and `reason="before startup"`. It SHALL NOT write that decision at `debug` or at `info`. A decision for any other reason SHALL keep its level: `no first prompt` and `too old` at `debug`, `rename request`, `current title shares the base`, `no rename request` and `malformed request` at `info`, and `title event failed` at `error`. Later title events of the same chat SHALL log no decision.

#### Scenario: Existing chat at editor load

- **WHEN** a title event reports a chat whose first prompt was submitted before the renamer started
- **THEN** a `trace` entry in `[title-event]` has `decision="ignore"` and `reason="before startup"`
- **AND** no `debug` or `info` decision entry is written for that chat

#### Scenario: Unreadable prompt stays at debug

- **WHEN** a title event reports a chat whose first prompt cannot be read
- **THEN** the decision entry is at `debug` with `reason="no first prompt"`
- **AND** it is not at `trace`

#### Scenario: New chat stays at info

- **WHEN** a new chat's first prompt matches a rename request and the chat is renamed
- **THEN** the decision entry is at `info` with `reason="rename request"`
