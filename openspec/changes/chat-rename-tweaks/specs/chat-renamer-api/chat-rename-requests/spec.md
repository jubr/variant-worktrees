## MODIFIED Requirements

### Requirement: Activation patterns derive a title

The renamer SHALL test each line of a prompt against a list of JavaScript regular expressions. A match SHALL produce a title equal to the first capture group that matched with text, or the whole match when there is none, trimmed. Slash commands SHALL win over patterns on the same prompt, and the first line that yields a request SHALL decide. An entry that is blank, not a string, or not a valid regular expression SHALL be skipped. The default list SHALL be `/[a-z]+-spec-[a-z]+\s+@\S+/[A-Za-z0-9_]+-([A-Za-z0-9_-]+)/?(?=\s|$)` and `/[a-z]+-spec-[a-z]+\s+([A-Za-z0-9_-]+)`, in that order. The first pattern SHALL capture the slug of the last path segment after its leading prefix token, and SHALL NOT hardcode a worktree prefix.

#### Scenario: Default pattern

- **WHEN** a prompt line is `/vw-spec-start cursor-chat-win-rename`
- **THEN** the requested title is `cursor-chat-win-rename`

#### Scenario: Default path pattern

- **WHEN** the default patterns are in use and a prompt line is `/vw-spec-iterate @/Users/me/_v-outer/_v-inner`
- **THEN** the requested title is `inner`

#### Scenario: Default path pattern keeps a longer slug

- **WHEN** a prompt line is `/vw-spec-iterate @/Users/me/vw/_v-cursor-chat-win-rename/`
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

A title that came from an activation pattern SHALL be made distinct from the titles of the other open chats when the candidate has no trailing digits and a peer shares its base. The base is the title with its trailing digits removed. Peers with the same base, compared case-insensitively, SHALL count by their trailing number, a peer without one counting as 1. When the candidate has no trailing digits and any peer shares the base, the title SHALL be the base followed by the largest number plus one. When the candidate has trailing digits, that number SHALL be kept: the chat SHALL NOT be renamed to the base plus a new number. A chat whose current title is already that candidate SHALL NOT be renamed. When no peer shares the base, the title SHALL stay as typed, and a chat whose current title is already that title SHALL NOT be renamed. A chat whose current title is different SHALL be renamed to the typed title. Slash command titles SHALL NOT be numbered. A title that is only digits SHALL stay unchanged.

#### Scenario: One peer

- **WHEN** the title is `abc` and another open chat is titled `abc`
- **THEN** the chat is renamed `abc2`

#### Scenario: Highest number wins

- **WHEN** the title is `def` and other open chats are titled `def3` and `def5`
- **THEN** the chat is renamed `def6`

#### Scenario: A typed number is dropped

- **WHEN** the title is `abc7` and another open chat is titled `abc`
- **THEN** the chat is not renamed

#### Scenario: A typed number replaces another title

- **WHEN** the chat is titled `New Chat`, the pattern title is `abc7`, and another open chat is titled `abc`
- **THEN** the chat is renamed `abc7`

#### Scenario: No shared base

- **WHEN** the title is `abc` and the other open chats are titled `abcd` and `other`
- **THEN** the chat is not renamed

#### Scenario: Unique pattern title still renames

- **WHEN** the chat is titled `New Chat`, the pattern title is `abc`, and the other open chats are titled `abcd` and `other`
- **THEN** the chat is renamed `abc`

#### Scenario: Slash titles are literal

- **WHEN** the prompt is `/chat-rename abc` and another open chat is titled `abc`
- **THEN** the chat is renamed `abc`

### Requirement: Dragged-in worktrees derive their slug

A prompt line that is a command of the form `/<word>-spec-<word>` followed by `@` and a path whose last segment is `<prefix><slug>` SHALL derive the title `<slug>`, for each configured worktree prefix. A prefix holds its own leading character and connector (`_v-`), so nothing is inserted between it and the slug. The slug SHALL consist of letters, digits, `_` and `-`. A trailing `/` after the path SHALL be accepted. Only the last path segment SHALL count. A prefix SHALL match literally, whatever characters it holds. An empty prefix list SHALL turn prefix-specific derivation off. The default path pattern SHALL still derive a title from such a line when the prefix list is empty. A non-empty prefix list SHALL be the only matcher for `@` paths: a prefix that is not in the list SHALL produce no title. Titles derived this way SHALL be numbered like other pattern titles.

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

- **WHEN** the configured prefix list is empty and the default patterns are in use
- **THEN** `/vw-spec-iterate @/Users/me/_v-outer/_v-inner` requests the title `inner`
