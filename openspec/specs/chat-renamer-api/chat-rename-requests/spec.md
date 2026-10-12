# chat-renamer-api Specification

## Purpose

Defines how prompt text becomes a Cursor chat title for the chat renamer: slash commands, activation patterns, and title numbering. Editor independent.

## Requirements

### Requirement: Slash commands name a chat literally

A prompt line starting with `/chat-rename` or `/rename-chat`, followed by whitespace or the end of the line, SHALL be a rename request. The title SHALL be a double-quoted string, a single-quoted string (smart quotes accepted), or a single bare word, and SHALL be used exactly as written. A command with no title, an empty title, an unterminated quote, or several unquoted words SHALL be reported as an error and SHALL NOT rename.

#### Scenario: Double-quoted title

- **WHEN** the prompt is `/chat-rename "two words"`
- **THEN** the requested title is `two words`

#### Scenario: Single-quoted title

- **WHEN** the prompt is `/rename-chat 'two words'`
- **THEN** the requested title is `two words`

#### Scenario: Bare word

- **WHEN** the prompt is `/chat-rename single-word`
- **THEN** the requested title is `single-word`

#### Scenario: Several unquoted words

- **WHEN** the prompt is `/chat-rename two words`
- **THEN** the request is an error that asks for quotes and no rename happens

#### Scenario: A longer command name is not a request

- **WHEN** the prompt is `/chat-renamed x`
- **THEN** the prompt holds no rename request

### Requirement: Activation patterns derive a title

The renamer SHALL test each line of a prompt against a list of JavaScript regular expressions. A match SHALL produce a title equal to the first capture group that matched with text, or the whole match when there is none, trimmed. Slash commands SHALL win over patterns on the same prompt, and the first line that yields a request SHALL decide. An entry that is blank, not a string, or not a valid regular expression SHALL be skipped. The default list SHALL be `/[a-z]+-spec-[a-z]+\s+([A-Za-z0-9_-]+)`.

#### Scenario: Default pattern

- **WHEN** a prompt line is `/vw-spec-start cursor-chat-win-rename`
- **THEN** the requested title is `cursor-chat-win-rename`

#### Scenario: Pattern on a later line

- **WHEN** a prompt has the lines `please` and `/vw-spec-iterate my_slug2`
- **THEN** the requested title is `my_slug2`

#### Scenario: Prompt without a request

- **WHEN** a prompt is `fix the build`, `/vw-spec-start` with no slug, or `vw-spec-start slug` without the leading slash
- **THEN** the prompt holds no rename request

#### Scenario: Invalid pattern

- **WHEN** the configured list holds `(` and a valid pattern
- **THEN** only the valid pattern is used and the invalid one is reported

#### Scenario: Slash command wins

- **WHEN** a line is a slash command whose title the patterns would also match
- **THEN** the slash title is used literally

### Requirement: Pattern titles are numbered against open chats

A title that came from an activation pattern SHALL be made distinct from the titles of the other open chats. The base is the title with its trailing digits removed. Peers with the same base, compared case-insensitively, SHALL count by their trailing number, a peer without one counting as 1. When any peer shares the base, the title SHALL be the base followed by the largest number plus one. Otherwise the title SHALL stay as typed. Slash command titles SHALL NOT be numbered. A title that is only digits SHALL stay unchanged.

#### Scenario: One peer

- **WHEN** the title is `abc` and another open chat is titled `abc`
- **THEN** the chat is renamed `abc2`

#### Scenario: Highest number wins

- **WHEN** the title is `def` and other open chats are titled `def3` and `def5`
- **THEN** the chat is renamed `def6`

#### Scenario: A typed number is dropped

- **WHEN** the title is `abc7` and another open chat is titled `abc`
- **THEN** the chat is renamed `abc2`

#### Scenario: No shared base

- **WHEN** the title is `abc` and the other open chats are titled `abcd` and `other`
- **THEN** the chat is renamed `abc`

#### Scenario: Slash titles are literal

- **WHEN** the prompt is `/chat-rename abc` and another open chat is titled `abc`
- **THEN** the chat is renamed `abc`

### Requirement: Dragged-in worktrees derive their slug

A prompt line that is a command of the form `/<word>-spec-<word>` followed by `@` and a path whose last segment is `<prefix><slug>` SHALL derive the title `<slug>`, for each configured worktree prefix. A prefix holds its own leading character and connector (`_v-`), so nothing is inserted between it and the slug. The slug SHALL consist of letters, digits, `_` and `-`. A trailing `/` after the path SHALL be accepted. Only the last path segment SHALL count. A prefix SHALL match literally, whatever characters it holds. An empty prefix list SHALL turn the derivation off. Titles derived this way SHALL be numbered like other pattern titles.

#### Scenario: Configured prefix

- **WHEN** the configured prefixes are `_v-` and a prompt line is `/vw-spec-iterate @/Users/me/vw/_v-cursor-chat-win-rename`
- **THEN** the requested title is `cursor-chat-win-rename`

#### Scenario: Custom prefix

- **WHEN** the configured prefixes are `_work-` and a prompt line is `/vw-spec-iterate @/Users/me/vw/_work-my-slug/`
- **THEN** the requested title is `my-slug`

#### Scenario: Prefix that is not configured

- **WHEN** the configured prefixes are `_v-` and a prompt line is `/vw-spec-iterate @/Users/me/vw/_work-my-slug`
- **THEN** the prompt holds no rename request

#### Scenario: Last segment wins

- **WHEN** a prompt line is `/vw-spec-iterate @/Users/me/_v-outer/_v-inner`
- **THEN** the requested title is `inner`

#### Scenario: Derivation switched off

- **WHEN** the configured prefix list is empty
- **THEN** `/vw-spec-iterate @/Users/me/vw/_v-my-slug` holds no rename request

### Requirement: Existing chats are numbered by creation order

When several existing chats yield pattern titles with the same base (case-insensitive, trailing digits removed), the plan SHALL give the oldest chat the plain base and the n-th oldest the base followed by n. Chats with equal creation times SHALL be ordered by chat id. A title that came from a slash command SHALL be used as written and SHALL NOT count toward a group. A chat whose current title already equals its planned title SHALL NOT be renamed. The plan SHALL be independent of the order in which chats are listed.

#### Scenario: Oldest first

- **WHEN** three chats created at 1, 2 and 3 all yield `abc` (or `abc7`, `abc`)
- **THEN** the plan names them `abc`, `abc2` and `abc3` in creation order

#### Scenario: Listing order does not matter

- **WHEN** the same chats are listed newest first
- **THEN** the plan is the same

#### Scenario: Separate groups

- **WHEN** one chat yields `abc` and another `def`
- **THEN** both keep their plain titles

#### Scenario: Slash titles stay literal

- **WHEN** a chat yields `abc` from `/chat-rename abc` and an older one yields `abc` from a pattern
- **THEN** the older chat is named `abc` and the slash chat keeps `abc`

#### Scenario: Already named

- **WHEN** a chat's current title equals its planned title
- **THEN** it is left out of the changes

### Requirement: A chat that already has the requested base is not renamed

When a title derived from an activation pattern would be given to a chat whose current title has the same base (trailing digits removed, compared case-insensitively), the chat SHALL be left untouched, both when planning renames of existing chats and when a title event names a new chat. A title from a slash command SHALL NOT be skipped on this ground, since the user asked for it literally. In the plan for existing chats, a chat left untouched for this reason still holds its number: the other chats of the group, oldest first, SHALL take the smallest numbers (`abc` for 1, then `abc2`, ...) that no untouched chat of the group holds, and a title with no trailing number holds 1.

#### Scenario: Same base, other number

- **WHEN** a chat is titled `abc3` and its first prompt yields `abc`
- **THEN** it is not renamed

#### Scenario: Case-insensitive

- **WHEN** a chat is titled `ABC` and its first prompt yields `abc`
- **THEN** it is not renamed

#### Scenario: Slash titles are not skipped

- **WHEN** a chat is titled `abc3` and its first prompt is `/chat-rename abc`
- **THEN** it is renamed `abc`

#### Scenario: Untouched chats hold their number

- **WHEN** a chat titled `abc` is kept and two older and newer chats with other titles both yield `abc`
- **THEN** they are named `abc2` and `abc3` in creation order

#### Scenario: Untouched newer chat holds the plain title

- **WHEN** an older chat with another title and a newer chat titled `abc` both yield `abc`
- **THEN** the older chat is named `abc2` and the newer one is not renamed

#### Scenario: Title event for a chat that already has the base

- **WHEN** a title event reports the title `abc4` for a new chat whose first prompt yields `abc`
- **THEN** the chat is not renamed
