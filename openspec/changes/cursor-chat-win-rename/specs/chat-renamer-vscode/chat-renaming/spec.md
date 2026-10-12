## Purpose

Defines when the chat renamer extension renames a Cursor chat: its triggers, that it acts only on chats created while the editor runs, that only one instance acts, and how a host extension embeds it. Experimental; relies on private Cursor internals.

## ADDED Requirements

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

The renamer SHALL read settings `trigger` (`titleEvent` or `hook`), `hookScope` (`workspace` or `user`), `activationPatterns` (string array), `worktreePrefixes` (string array, default `["_v"]`) and `renameExistingChats` (boolean, default true) from a configurable section, falling back to defaults for unknown values; an empty `activationPatterns` array SHALL turn patterns off. A host extension SHALL be able to choose the command prefix and settings section, and SHALL contribute the settings in its own manifest. Changing the settings SHALL reconfigure the trigger without a reload.

#### Scenario: Standalone defaults

- **WHEN** the standalone extension activates
- **THEN** commands `chat-renamer.renameChat` and `chat-renamer.renameChatFromPrompt` are registered and settings are read from `chat-renamer.*`

#### Scenario: Embedded in Variant

- **WHEN** `variant-vscode` activates
- **THEN** commands `variant-worktrees.renameChat` and `variant-worktrees.renameChatFromPrompt` are registered and settings are read from `variant-worktrees.chatRename.*`

#### Scenario: Manifest copy stays in step

- **WHEN** the standalone manifest contributes a setting
- **THEN** the embedding host manifest contributes the same setting under its own section

### Requirement: Existing chats are renamed when enabled

With setting `renameExistingChats` true (the default) the active instance SHALL rename existing chats: chats listed by Cursor whose first prompt was submitted before the renamer started, whose first prompt can be read, and which holds a rename request. The names SHALL follow the creation-order numbering of the request capability. The run SHALL happen shortly after startup, again after Cursor has reported title events for chats that existed at startup (waiting for the reports to stop), and when the command `<prefix>.renameExistingChats` runs. Each chat examined with a readable, timestamped first prompt SHALL be recorded in the extension's persistent state, and a recorded chat SHALL NOT be examined again by an automatic run, so a title the user later changes by hand stays. The command SHALL ignore the record. A chat whose first prompt cannot be read SHALL NOT be recorded. With the setting false none of this SHALL run, and changing the setting SHALL take effect without a reload.

#### Scenario: Backfill orders by creation time

- **WHEN** three existing chats created at 1, 2 and 3 all hold `/vw-spec-start abc`
- **THEN** they are renamed `abc`, `abc2` and `abc3` in creation order

#### Scenario: Chats created after startup are left to the realtime path

- **WHEN** a listed chat's first prompt was submitted after the renamer started
- **THEN** the existing-chats run does not rename it

#### Scenario: Recorded chats are not touched again

- **WHEN** a chat was examined by an earlier run and the user renamed it by hand
- **THEN** an automatic run leaves its title alone

#### Scenario: Command re-runs everything

- **WHEN** the user runs `<prefix>.renameExistingChats`
- **THEN** recorded chats are examined again

#### Scenario: Unreadable prompt is retried later

- **WHEN** a listed chat's first prompt cannot be read
- **THEN** it is not renamed and not recorded

#### Scenario: Switched off

- **WHEN** `renameExistingChats` is false
- **THEN** no existing chat is renamed at startup, after title events, or by the automatic runs

