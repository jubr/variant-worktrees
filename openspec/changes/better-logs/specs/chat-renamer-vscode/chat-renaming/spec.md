## ADDED Requirements

### Requirement: The log channel is a log output channel

The renamer SHALL write its log to a log output channel named `Chat Renamer`, or `Variant Worktrees` when embedded in the Variant Worktrees extension, created when the extension activates. The channel SHALL be listed by the editor's **Developer: Show Logs…** command and SHALL honour the editor's log level for that channel. Both extension manifests SHALL activate on startup (`onStartupFinished`) so the channel is listed without first running a command. Outside an editor host the renamer SHALL log nothing and SHALL NOT fail.

#### Scenario: Standalone channel

- **WHEN** the standalone extension activates
- **THEN** a log output channel named `Chat Renamer` exists

#### Scenario: Embedded channel

- **WHEN** Variant Worktrees activates
- **THEN** a log output channel named `Variant Worktrees` exists and no `Chat Renamer` channel is created

#### Scenario: Activates on startup

- **WHEN** either extension manifest is read
- **THEN** its `activationEvents` contain `onStartupFinished`

### Requirement: Log lines are leveled and structured

A log entry SHALL have a level of `trace`, `debug`, `info`, `warn` or `error`, written through the channel's own level. A log entry MAY carry a category, rendered as a `[category]` prefix before the message, and MAY carry fields, rendered after the message as `key=value` pairs. A string, object or array field value SHALL be rendered as JSON, so a value with spaces stays one pair; other values SHALL be rendered with their plain text. The renamer SHALL NOT add a timestamp or level text to the message, since the channel supplies both. Entries about renaming existing chats SHALL keep their `[existing-chats]` prefix and message text.

#### Scenario: Category and fields

- **WHEN** the renamer logs `decision` at `info` in category `title-event` with fields `session` `abc-1` and `matched` `true`
- **THEN** the channel receives an `info` entry `[title-event] decision session="abc-1" matched=true`

#### Scenario: No category

- **WHEN** the renamer logs `activation patterns` with no category and no fields
- **THEN** the channel receives the message unchanged

#### Scenario: Existing-chats prefix unchanged

- **WHEN** the existing-chats run logs that it is off
- **THEN** the entry text starts with `[existing-chats] off` as before

### Requirement: The title event reads only the first 10 prompt lines

When the title event trigger looks for a rename request in a chat's first prompt, it SHALL test only the first 10 lines of that prompt, counting a line break as `\n` or `\r\n`. A slash command or activation pattern match on line 11 or later SHALL NOT rename the chat. The first 10 lines SHALL be written to the log at `trace` level, in category `title-event`, together with the chat id and the number of lines dropped, before they are matched. Nothing of the prompt beyond line 10 SHALL be logged. The limit applies to the title event trigger only.

#### Scenario: Match inside the limit

- **WHEN** a new chat's first prompt has 12 lines and `/vw-spec-start abc` is line 10
- **THEN** the chat is renamed `abc`

#### Scenario: Match beyond the limit

- **WHEN** a new chat's first prompt has 12 lines and `/vw-spec-start abc` is line 11
- **THEN** the chat is not renamed and the decision is `ignore` with reason `no rename request`

#### Scenario: Prompt written at trace level

- **WHEN** a new chat's first prompt has 12 lines
- **THEN** a `trace` entry in `[title-event]` holds lines 1 to 10, the chat id, and `dropped=2`, and no `debug`, `info`, `warn` or `error` entry holds the prompt text

#### Scenario: Other triggers are not limited

- **WHEN** the existing-chats run or the `renameActiveChat` command reads a prompt whose pattern match is on line 11
- **THEN** the chat is renamed as before

### Requirement: The title event decision is logged

For the first title event of every chat, the renamer SHALL log exactly one decision entry at `info` level in category `title-event`. The entry SHALL carry the chat id (`session`), `matched` (whether a slash command or an activation pattern matched), `decision`, and `reason`. When an activation pattern matched it SHALL carry `pattern`, the zero-based index of the pattern in the compiled list. `decision` SHALL be `rename` when the chat is renamed, `keep` when the chat already has the requested base, and `ignore` otherwise, with a rename request written as `title`. `reason` SHALL be `rename request` for `rename`, `current title shares the base` for `keep`, and for `ignore` one of `no first prompt`, `before startup`, `too old`, `no rename request`, `malformed request`, or `title event failed`. An `ignore` for `no first prompt`, `before startup` or `too old` SHALL be logged at `debug` level instead, so the burst of title events at editor load does not fill the `info` log, and an `ignore` for `title event failed` SHALL be logged at `error` level with the failure text. Later title events of the same chat SHALL log no decision.

#### Scenario: Pattern matched and renamed

- **WHEN** a new chat's first prompt is `/vw-spec-start abc` and the default patterns are in use, so the third pattern (index 2) matches
- **THEN** the log has an `info` entry in `[title-event]` with `matched=true`, `pattern=2`, `decision="rename"`, `reason="rename request"` and `title="abc"`

#### Scenario: Slash command renamed

- **WHEN** a new chat's first prompt is `/chat-rename "two words"`
- **THEN** the entry has `matched=true`, `decision="rename"` and no `pattern`

#### Scenario: No pattern matched

- **WHEN** a new chat's first prompt is `hello there`
- **THEN** the entry has `matched=false`, `decision="ignore"` and `reason="no rename request"`

#### Scenario: Malformed slash command

- **WHEN** a new chat's first prompt is `/chat-rename two words`
- **THEN** the entry has `matched=true`, `decision="ignore"` and `reason="malformed request"`, and the chat is not renamed

#### Scenario: Current title already shares the base

- **WHEN** a pattern matches and the chat's current title already has the requested base
- **THEN** the entry has `decision="keep"` and `reason="current title shares the base"`

#### Scenario: Existing chat at editor load

- **WHEN** a title event reports a chat whose first prompt was submitted before the renamer started
- **THEN** a `debug` entry in `[title-event]` has `decision="ignore"` and `reason="before startup"`, and no `info` decision entry is written

#### Scenario: Later title event

- **WHEN** a chat reports a second title
- **THEN** no decision entry is logged for it
