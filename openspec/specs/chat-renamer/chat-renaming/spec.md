# chat-renamer Specification

## Purpose

Defines when the chat renamer extension renames a Cursor chat: its triggers, that it acts only on chats created while the editor runs, that only one instance acts, and how a host extension embeds it. Experimental; relies on private Cursor internals.

## Requirements

### Requirement: Title event trigger

With setting `trigger` equal to `titleEvent` (the default), the renamer SHALL listen for Cursor's chat catalog title change event. On the first title event of a chat it SHALL read that chat's first prompt from Cursor's on-disk store and rename the chat when the prompt holds a rename request. Later title events of the same chat SHALL be ignored. A malformed request SHALL be logged and SHALL NOT rename.

#### Scenario: Pattern prompt renames a new chat

- **WHEN** a chat is created with the first prompt `/vw-spec-start abc` and Cursor reports its title
- **THEN** the chat is renamed `abc`

#### Scenario: Later title change is ignored

- **WHEN** the same chat reports a second title
- **THEN** no rename happens

### Requirement: The title event trigger renames only chats created while the editor runs

The title event trigger SHALL rename a chat only when its first prompt carries a timestamp, the timestamp is later than the moment the renamer started listening, and it is no more than 30 seconds old. A chat whose first prompt cannot be read, or has no timestamp, SHALL be left alone. The renamer SHALL NOT parse the title text as a fallback. Chats that existed before startup are handled only by the existing-chats requirement below.

#### Scenario: Existing chats reported at load

- **WHEN** Cursor reports title events for chats whose first prompts were submitted before the renamer started
- **THEN** none of them is renamed

#### Scenario: Prompt too old

- **WHEN** a chat's first prompt was submitted more than 30 seconds ago and later reports its first title event
- **THEN** it is not renamed

#### Scenario: Unreadable first prompt

- **WHEN** the first prompt of a reported chat cannot be read
- **THEN** it is not renamed

#### Scenario: Fresh chat inside the window

- **WHEN** a chat's first prompt was submitted after the renamer started and 5 seconds ago
- **THEN** it is renamed when the prompt holds a rename request

### Requirement: Hook trigger

With `trigger` equal to `hook`, the renamer SHALL install a `beforeSubmitPrompt` hook script and a `hooks.json` entry in `.cursor` of the first workspace folder (`hookScope` `workspace`) or the user home (`user`), merging with existing hooks. An unparsable `hooks.json` SHALL NOT be overwritten. The script SHALL open the extension URI for a prompt line that is a slash command or matches an activation pattern, SHALL block a prompt that is only a slash command, and SHALL let every other prompt through. Leaving `hook` mode SHALL remove the entry and script the renamer wrote and no others.

#### Scenario: Lone slash command

- **WHEN** the submitted prompt is `/chat-rename "two words"`
- **THEN** the extension URI is opened and the prompt is blocked

#### Scenario: Pattern prompt

- **WHEN** the submitted prompt is `/vw-spec-start my-slug`
- **THEN** the extension URI is opened and the prompt continues to the model

#### Scenario: Ordinary prompt

- **WHEN** the submitted prompt is `fix the build`
- **THEN** nothing is opened and the prompt continues

### Requirement: One active instance

When several extensions in one extension host embed the renamer, exactly one SHALL run the triggers. The first to start SHALL claim ownership through a host-wide registry. Any other SHALL NOT listen for title events, install a hook, or register the URI handler, SHALL remove any hook script it wrote earlier, and SHALL log which extension owns renaming. Ownership SHALL be released when the owner is disposed. Rename commands SHALL stay registered in every instance.

#### Scenario: Standalone and Variant both loaded

- **WHEN** Variant activates first and Chat Renamer activates second in the same host
- **THEN** only Variant listens for title events
- **AND** a new chat is renamed once

#### Scenario: Idle instance cleans up

- **WHEN** an idle instance previously installed a hook script
- **THEN** that script and its `hooks.json` entry are removed

#### Scenario: Single instance

- **WHEN** only one extension embeds the renamer
- **THEN** it owns renaming

### Requirement: Settings and embedding

The renamer SHALL read settings `trigger` (`titleEvent` or `hook`), `hookScope` (`workspace` or `user`), `activationPatterns` (string array), `worktreePrefixes` (string array of prefixes including their connector, default empty) and `renameExistingDays` (non-negative integer, default 7, 0 = off) from a configurable section, falling back to defaults for unknown values; an empty `activationPatterns` array SHALL turn patterns off. A host extension SHALL be able to supply the same options, for example from `variants.yaml` (`chatRenamer`). When embedded in Variant, `worktreePrefixes` SHALL default to the workspace's `variant.prefix`, so the prefix is defined once; an explicit `chatRenamer.worktreePrefixes` replaces that default rather than adding to it. An option the user set explicitly in the editor settings SHALL win over the host-supplied value, which SHALL win over the default. A host extension SHALL be able to choose the command prefix and settings section, and SHALL contribute the settings in its own manifest. Changing the settings SHALL reconfigure the trigger without a reload. When `worktreePrefixes` is empty, the default path pattern SHALL derive a title from a dragged-in path. When `worktreePrefixes` is non-empty, only those prefixes SHALL match `@` paths. When embedded in Variant, those settings SHALL be read from section `variant` (`variant.trigger`, `variant.hookScope`, `variant.activationPatterns`, `variant.worktreePrefixes`, `variant.renameExistingDays`). That section SHALL also contribute `variant.enable`, a boolean that defaults to true and is not a `variants.yaml` field. When `variant.enable` is false, the embedded renamer SHALL NOT rename: it SHALL NOT listen for title events, SHALL NOT install a hook, SHALL uninstall a hook it wrote earlier, and SHALL NOT rename existing chats. Palette commands SHALL stay registered and, when `variant.enable` is false, SHALL NOT rename and SHALL tell the user that `variant.enable` is false. A settings section with no `enable` key SHALL leave renaming on. Changing `variant.enable` SHALL apply without a reload.

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

### Requirement: Existing chats are renamed within a day window

With setting `renameExistingDays` greater than 0 (default 7) the active instance SHALL rename existing chats: chats listed by Cursor whose first prompt was submitted before the renamer started and no more than `renameExistingDays` days before it, whose first prompt can be read, and which holds a rename request. The names SHALL follow the creation-order numbering of the request capability. The run SHALL happen shortly after startup, again after Cursor has reported title events for chats that existed at startup (waiting for the reports to stop), when the setting changes, and when the command `<prefix>.renameExistingChats` runs. Each chat examined inside the window with a readable, timestamped first prompt SHALL be recorded in the extension's persistent state, and a recorded chat SHALL NOT be examined again by an automatic run, so a title the user later changes by hand stays. The command SHALL ignore the record but SHALL obey the window. A chat whose first prompt cannot be read, and a chat outside the window, SHALL NOT be recorded. With the setting 0 none of this SHALL run, and changing the setting SHALL take effect without a reload.

#### Scenario: Backfill orders by creation time

- **WHEN** three existing chats created at 1, 2 and 3 all hold `/vw-spec-start abc`
- **THEN** they are renamed `abc`, `abc2` and `abc3` in creation order

#### Scenario: Chats created after startup are left to the realtime path

- **WHEN** a listed chat's first prompt was submitted after the renamer started
- **THEN** the existing-chats run does not rename it

#### Scenario: Chats older than the window are left alone

- **WHEN** `renameExistingDays` is 7 and a listed chat's first prompt is 8 days older than the start
- **THEN** it is neither renamed nor recorded

#### Scenario: Window is widened later

- **WHEN** a chat was outside the window in an earlier run and `renameExistingDays` is then raised to cover it
- **THEN** the next run renames it

#### Scenario: Recorded chats are not touched again

- **WHEN** a chat was examined by an earlier run and the user renamed it by hand
- **THEN** an automatic run leaves its title alone

#### Scenario: Command re-runs everything in the window

- **WHEN** the user runs `<prefix>.renameExistingChats`
- **THEN** recorded chats inside the window are examined again

#### Scenario: Unreadable prompt is retried later

- **WHEN** a listed chat's first prompt cannot be read
- **THEN** it is not renamed and not recorded

#### Scenario: Switched off

- **WHEN** `renameExistingDays` is 0
- **THEN** no existing chat is renamed at startup, after title events, or by the automatic runs

#### Scenario: Command while switched off

- **WHEN** `renameExistingDays` is 0 and the user runs `<prefix>.renameExistingChats`
- **THEN** no chat is renamed and the user is told that `<section>.renameExistingDays` is 0

### Requirement: Existing-chats activity is clearly logged

Every log line about renaming existing chats SHALL start with `[existing-chats]`. A run SHALL log what triggered it (`startup`, `title events settled`, `setting changed` or `command`) together with the setting it obeys, written as `<section>.renameExistingDays=<value>`, and the start of the window. When the setting is 0 the log SHALL say the feature is off and name the setting. Each rename SHALL log the chat id, old title, new title and creation time, and the run SHALL end with a summary of listed, examined, renamed and failed chats.

#### Scenario: Startup run

- **WHEN** the startup run begins with `renameExistingDays` 7 in section `variant`
- **THEN** the log has a `[existing-chats]` line naming trigger `startup` and `variant.renameExistingDays=7`

#### Scenario: Off is explained

- **WHEN** the renamer starts with `renameExistingDays` 0
- **THEN** the log has a `[existing-chats]` line saying existing chats are off because `<section>.renameExistingDays=0`

### Requirement: Rename the active chat on command

The standalone extension SHALL contribute command `chat-renamer.renameActiveChat` with palette title `Chat Renamer: Rename active chat`. When embedded in Variant, the command SHALL be `variant.renameActiveChat` with palette title `Variant: Rename active chat`. Running it SHALL rename the chat the user currently has selected, using that chat's first prompt and the same request, numbering, and same-base rules as a title event. It SHALL NOT apply the limit that a chat must have been created while the editor runs, and it SHALL NOT apply the 30-second age limit. It SHALL run when `renameExistingDays` is 0. When no chat is selected, or the first prompt holds no rename request, the command SHALL NOT rename and SHALL tell the user. The command SHALL stay registered while the instance is idle.

#### Scenario: Active chat with an old pattern prompt

- **WHEN** the selected chat's first prompt is `/vw-spec-start abc` and that prompt is older than 30 seconds
- **THEN** the chat is renamed `abc`

#### Scenario: No rename request

- **WHEN** the selected chat's first prompt is `fix the build`
- **THEN** the chat is not renamed and the user is told

#### Scenario: No selected chat

- **WHEN** no chat is selected
- **THEN** no chat is renamed and the user is told

#### Scenario: Palette titles

- **WHEN** the standalone extension and Variant each contribute the command
- **THEN** the palette shows `Chat Renamer: Rename active chat` and `Variant: Rename active chat`

### Requirement: Rename actions are logged with a reason and the final title

Whenever the renamer renames a chat, the log SHALL include the chat id, the reason the title was chosen, and the final title. The line SHALL be `rename <chat id>: <reason>; title <json title>`. The reason SHALL be `slash command` for a slash-command title, `all digits` for a title that is only digits, `typed trailing number kept` when the pattern title already ends in digits, `numbered against open chats` when peer numbering changes the title, `no shared base` when a pattern title is used as typed, and `explicit title` when the caller passes the title to the rename command. When a pattern request is not applied because the chat's current title already shares that base, the log SHALL use the same line with reason `current title shares the base` and the current title, and the chat SHALL NOT be renamed. An existing-chats rename SHALL keep the `[existing-chats]` prefix and SHALL include the reason `existing chats plan` and the final title.

#### Scenario: Numbered pattern title

- **WHEN** a pattern title `abc` is applied and another open chat is titled `abc`
- **THEN** the log contains the chat id, `numbered against open chats`, and the title `abc2`

#### Scenario: Typed trailing number

- **WHEN** a chat titled `New Chat` has pattern title `abc7` and another open chat is titled `abc`
- **THEN** the log contains `typed trailing number kept` and the title `abc7`

#### Scenario: No shared base

- **WHEN** a chat titled `New Chat` has pattern title `abc` and the other open chats are titled `abcd` and `other`
- **THEN** the log contains `no shared base` and the title `abc`

#### Scenario: Current title already shares the base

- **WHEN** a chat titled `abc7` has pattern title `abc7` and another open chat is titled `abc`
- **THEN** the log contains `current title shares the base` and the title `abc7`
- **AND** the chat is not renamed

#### Scenario: Slash command

- **WHEN** the prompt is `/chat-rename abc` and another open chat is titled `abc`
- **THEN** the log contains `slash command` and the title `abc`

#### Scenario: Existing chats

- **WHEN** the existing-chats run renames a chat to `abc`
- **THEN** the log has a `[existing-chats]` line that contains `existing chats plan` and the title `abc`

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

### Requirement: Packaged vsix is written to the repository out directory

Every extension package script that produces a `.vsix` SHALL write it into the repository-root `out/` directory. `chat-renamer` SHALL write `out/chat-renamer-<version>.vsix`. `variant-vscode` SHALL write `out/variant-worktrees-<version>.vsix`. The repository `.gitignore` SHALL ignore `out/`.

#### Scenario: Chat renamer package output is ignored

- **WHEN** the `chat-renamer` package script runs for version `0.0.1`
- **THEN** the file `out/chat-renamer-0.0.1.vsix` exists at the repository root and git ignores `out/`

#### Scenario: Variant package output is ignored

- **WHEN** the `variant-vscode` package script runs for version `0.0.1`
- **THEN** the file `out/variant-worktrees-0.0.1.vsix` exists at the repository root and git ignores `out/`
