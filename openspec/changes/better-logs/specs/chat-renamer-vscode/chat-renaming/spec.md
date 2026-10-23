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

### Requirement: The title event reads a configured number of prompt lines

The renamer SHALL read a setting `titleEventPromptLines` (integer of at least 1, default 10) from its configuration section. When the title event trigger looks for a rename request in a chat's first prompt, it SHALL test only the first `titleEventPromptLines` lines of that prompt, counting a line break as `\n` or `\r\n`. A slash command or activation pattern match beyond that line SHALL NOT rename the chat. The lines read SHALL be written to the log at `trace` level, in category `title-event`, together with the chat id, `lines` (how many were read) and `dropped` (how many were left out), before they are matched. Nothing of the prompt beyond the limit SHALL be logged. A value that is not an integer of at least 1 SHALL fall back to 10. Changing the setting SHALL apply without a reload. The limit applies to the title event trigger only. The setting SHALL be a manifest setting of both extensions (`chat-renamer.titleEventPromptLines`, `variant.titleEventPromptLines`) and an option of the `chatRenamer` section of `variants.yaml`.

#### Scenario: Default limit, match inside it

- **WHEN** a new chat's first prompt has 12 lines, `titleEventPromptLines` is unset and `/vw-spec-start abc` is line 10
- **THEN** the chat is renamed `abc`

#### Scenario: Default limit, match beyond it

- **WHEN** a new chat's first prompt has 12 lines, `titleEventPromptLines` is unset and `/vw-spec-start abc` is line 11
- **THEN** the chat is not renamed and the decision is `ignore` with reason `no rename request`

#### Scenario: Wider limit

- **WHEN** `titleEventPromptLines` is 20 and `/vw-spec-start abc` is line 11 of a new chat's first prompt
- **THEN** the chat is renamed `abc`

#### Scenario: Narrower limit

- **WHEN** `titleEventPromptLines` is 1 and `/vw-spec-start abc` is line 2 of a new chat's first prompt
- **THEN** the chat is not renamed

#### Scenario: Invalid value

- **WHEN** `titleEventPromptLines` is `0`, `-3`, `2.5` or `"many"`
- **THEN** the renamer reads 10 lines

#### Scenario: Prompt written at trace level

- **WHEN** a new chat's first prompt has 12 lines and the limit is 10
- **THEN** a `trace` entry in `[title-event]` holds lines 1 to 10, the chat id, `lines=10` and `dropped=2`, and no `debug`, `info`, `warn` or `error` entry holds the prompt text

#### Scenario: Change applies without a reload

- **WHEN** `titleEventPromptLines` changes from 10 to 20 while the editor runs
- **THEN** the next new chat is read up to line 20

#### Scenario: Other triggers are not limited

- **WHEN** the existing-chats run or the `renameActiveChat` command reads a prompt whose pattern match is on line 11
- **THEN** the chat is renamed as before

### Requirement: The title event decision is logged

For the first title event of every chat, the renamer SHALL log exactly one decision entry at `info` level in category `title-event`. The entry SHALL carry the chat id (`session`), `matched` (whether a slash command or an activation pattern matched), `decision`, and `reason`. For `malformed request` and `title event failed` it SHALL also carry `detail`, the parse reason or the error message. When an activation pattern matched it SHALL carry `pattern`, the zero-based index of the pattern in the compiled list. `decision` SHALL be `rename` when the chat is renamed, `keep` when the chat already has the requested base, and `ignore` otherwise, with a rename request written as `title`. `reason` SHALL be `rename request` for `rename`, `current title shares the base` for `keep`, and for `ignore` one of `no first prompt`, `before startup`, `too old`, `no rename request`, `malformed request`, or `title event failed`. An `ignore` for `no first prompt`, `before startup` or `too old` SHALL be logged at `debug` level instead, so the burst of title events at editor load does not fill the `info` log, and an `ignore` for `title event failed` SHALL be logged at `error` level with the failure text. Later title events of the same chat SHALL log no decision.

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
- **THEN** the entry has `matched=true`, `decision="ignore"`, `reason="malformed request"` and a `detail` with the parse reason, and the chat is not renamed

#### Scenario: Current title already shares the base

- **WHEN** a pattern matches and the chat's current title already has the requested base
- **THEN** the entry has `decision="keep"` and `reason="current title shares the base"`

#### Scenario: Existing chat at editor load

- **WHEN** a title event reports a chat whose first prompt was submitted before the renamer started
- **THEN** a `debug` entry in `[title-event]` has `decision="ignore"` and `reason="before startup"`, and no `info` decision entry is written

#### Scenario: Later title event

- **WHEN** a chat reports a second title
- **THEN** no decision entry is logged for it

### Requirement: Rename failures tell the user why

When the renamer tries to rename a chat and fails, it SHALL show the user a notification that names the cause. A title event rename that throws SHALL show a warning `Chat rename failed for <chat id>: <error message>`. When the `renameActiveChat` command does not rename because the decision is `ignore`, its notification SHALL include the decision reason (`no first prompt`, `no rename request`, or `malformed request` followed by the parse detail). When `renameActiveChat` throws, the notification SHALL include the error message. A title event that is ignored because the prompt holds no rename request SHALL NOT show a notification. Each notification SHALL be accompanied by the log entry that already records the cause.

#### Scenario: Title event rename throws

- **WHEN** the first prompt of a new chat is `/vw-spec-start abc` and the rename call rejects with `gate closed`
- **THEN** a warning `Chat rename failed for <chat id>: gate closed` is shown and the `error` decision entry carries `detail="gate closed"`

#### Scenario: Active chat without a rename request

- **WHEN** the selected chat's first prompt is `fix the build` and the user runs `renameActiveChat`
- **THEN** the notification says the chat was not renamed and gives the reason `no rename request`

#### Scenario: Active chat with a malformed request

- **WHEN** the selected chat's first prompt is `/chat-rename two words` and the user runs `renameActiveChat`
- **THEN** the notification gives the reason `malformed request` and the parse detail

#### Scenario: Active chat rename throws

- **WHEN** the rename call rejects with `gate closed` while the user runs `renameActiveChat`
- **THEN** the notification includes `gate closed`

#### Scenario: Ordinary title event stays quiet

- **WHEN** a new chat's first prompt is `hello there`
- **THEN** no notification is shown

## MODIFIED Requirements

### Requirement: Settings and embedding

The renamer SHALL read settings `trigger` (`titleEvent` or `hook`), `hookScope` (`workspace` or `user`), `activationPatterns` (string array), `worktreePrefixes` (string array of prefixes including their connector, default empty), `renameExistingDays` (non-negative integer, default 7, 0 = off) and `titleEventPromptLines` (integer of at least 1, default 10) from a configurable section, falling back to defaults for unknown values; an empty `activationPatterns` array SHALL turn patterns off. A host extension SHALL be able to supply the same options, for example from `variants.yaml` (`chatRenamer`). When embedded in Variant, `worktreePrefixes` SHALL default to the workspace's `variant.prefix`, so the prefix is defined once; an explicit `chatRenamer.worktreePrefixes` replaces that default rather than adding to it. An option the user set explicitly in the editor settings SHALL win over the host-supplied value, which SHALL win over the default. A host extension SHALL be able to choose the command prefix and settings section, and SHALL contribute the settings in its own manifest. Changing the settings SHALL reconfigure the trigger without a reload. When `worktreePrefixes` is empty, the default path pattern SHALL derive a title from a dragged-in path. When `worktreePrefixes` is non-empty, only those prefixes SHALL match `@` paths. When embedded in Variant, those settings SHALL be read from section `variant` (`variant.trigger`, `variant.hookScope`, `variant.activationPatterns`, `variant.worktreePrefixes`, `variant.renameExistingDays`, `variant.titleEventPromptLines`). That section SHALL also contribute `variant.enable`, a boolean that defaults to true and is not a `variants.yaml` field. When `variant.enable` is false, the embedded renamer SHALL NOT rename: it SHALL NOT listen for title events, SHALL NOT install a hook, SHALL uninstall a hook it wrote earlier, and SHALL NOT rename existing chats. Palette commands SHALL stay registered and, when `variant.enable` is false, SHALL NOT rename and SHALL tell the user that `variant.enable` is false. A settings section with no `enable` key SHALL leave renaming on. Changing `variant.enable` SHALL apply without a reload.

#### Scenario: Standalone defaults

- **WHEN** the standalone extension activates
- **THEN** commands `chat-renamer.renameChat`, `chat-renamer.renameChatFromPrompt` and `chat-renamer.renameActiveChat` are registered and settings are read from `chat-renamer.*`

#### Scenario: Embedded in Variant

- **WHEN** `variant-vscode` activates
- **THEN** commands `variant.renameChat`, `variant.renameChatFromPrompt` and `variant.renameActiveChat` are registered and settings are read from `variant.*`

#### Scenario: Variant prefix is recognised without repeating it

- **WHEN** `variant-vscode` activates in a workspace whose `variants.yaml` sets `variant.prefix: _work-` and no `chatRenamer.worktreePrefixes`
- **THEN** a prompt line `/vw-spec-iterate @/path/_work-my-slug` renames the chat `my-slug`, and `_v-my-slug` does not

#### Scenario: Explicit prefixes replace the derived one

- **WHEN** `variants.yaml` sets `variant.prefix: _work-` and `chatRenamer.worktreePrefixes: [_wt-]`
- **THEN** `_wt-my-slug` is recognised and `_work-my-slug` is not

#### Scenario: Standalone has no prefixes by default

- **WHEN** the standalone extension runs with no `worktreePrefixes` set and a prompt line is `/vw-spec-iterate @/Users/me/_v-outer/_v-inner`
- **THEN** the chat is renamed `inner`

#### Scenario: Value from variants.yaml

- **WHEN** the host supplies `renameExistingDays: 30` from `variants.yaml` and the user set nothing in the editor
- **THEN** the renamer uses 30

#### Scenario: Prompt-line limit from variants.yaml

- **WHEN** the host supplies `titleEventPromptLines: 20` from `variants.yaml` and the user set nothing in the editor
- **THEN** the title event reads 20 lines

#### Scenario: Editor setting wins

- **WHEN** the host supplies `renameExistingDays: 30` and the user set `0` in the editor settings
- **THEN** the renamer uses 0

#### Scenario: Manifest copy stays in step

- **WHEN** the standalone manifest contributes a setting
- **THEN** the embedding host manifest contributes the same setting under `variant.*`

#### Scenario: Variant enable defaults on

- **WHEN** `variant-vscode` activates and `variant.enable` is unset
- **THEN** chat renaming runs

#### Scenario: Variant enable switches renaming off

- **WHEN** `variant.enable` is false
- **THEN** a title event does not rename, existing chats are not renamed, no hook is installed, and `variant.renameActiveChat` does not rename
- **AND** the user is told that `variant.enable` is false

#### Scenario: Variant enable applies without a reload

- **WHEN** `variant.enable` changes from false to true
- **THEN** chat renaming starts without a reload

### Requirement: Rename the active chat on command

The standalone extension SHALL contribute command `chat-renamer.renameActiveChat` with palette title `Chat Renamer: Rename active chat`. When embedded in Variant, the command SHALL be `variant.renameActiveChat` with palette title `Variant: Rename active chat`. Running it SHALL rename the chat the user currently has selected, using that chat's first prompt and the same request, numbering, and same-base rules as a title event. It SHALL NOT apply the limit that a chat must have been created while the editor runs, it SHALL NOT apply the 30-second age limit, and it SHALL NOT apply `titleEventPromptLines`. It SHALL run when `renameExistingDays` is 0. When no chat is selected, or the first prompt holds no rename request, the command SHALL NOT rename and SHALL tell the user, naming the reason as the requirement "Rename failures tell the user why" says. The command SHALL stay registered while the instance is idle.

#### Scenario: Active chat with an old pattern prompt

- **WHEN** the selected chat's first prompt is `/vw-spec-start abc` and that prompt is older than 30 seconds
- **THEN** the chat is renamed `abc`

#### Scenario: Pattern beyond the title-event line limit

- **WHEN** the selected chat's first prompt has `/vw-spec-start abc` on line 11 and `titleEventPromptLines` is 10
- **THEN** the chat is renamed `abc`

#### Scenario: No rename request

- **WHEN** the selected chat's first prompt is `fix the build`
- **THEN** the chat is not renamed and the user is told, with the reason `no rename request`

#### Scenario: No selected chat

- **WHEN** no chat is selected
- **THEN** no chat is renamed and the user is told

#### Scenario: Palette titles

- **WHEN** the standalone extension and Variant each contribute the command
- **THEN** the palette shows `Chat Renamer: Rename active chat` and `Variant: Rename active chat`
