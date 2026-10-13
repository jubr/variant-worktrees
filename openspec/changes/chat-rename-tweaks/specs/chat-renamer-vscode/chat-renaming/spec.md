## ADDED Requirements

### Requirement: Rename the active chat on command

The standalone extension SHALL contribute command `chat-renamer.renameActiveChat` with palette title `Chat Renamer: Rename active chat`. When embedded in Variant, the command SHALL be `variant-worktrees.renameActiveChat` with palette title `Variant: Rename active chat`. Running it SHALL rename the chat the user currently has selected, using that chat's first prompt and the same request, numbering, and same-base rules as a title event. It SHALL NOT apply the limit that a chat must have been created while the editor runs, and it SHALL NOT apply the 30-second age limit. It SHALL run when `renameExistingDays` is 0. When no chat is selected, or the first prompt holds no rename request, the command SHALL NOT rename and SHALL tell the user. The command SHALL stay registered while the instance is idle.

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

### Requirement: Packaged vsix is written to the repository out directory

The `chat-renamer-vscode` package script SHALL write its `.vsix` into the repository-root `out/` directory, under the name `chat-renamer-vscode-<version>.vsix`. The repository `.gitignore` SHALL ignore `out/`.

#### Scenario: Package output is ignored

- **WHEN** the package script runs for version `0.0.1`
- **THEN** the file `out/chat-renamer-vscode-0.0.1.vsix` exists at the repository root and git ignores `out/`

## MODIFIED Requirements

### Requirement: Settings and embedding

The renamer SHALL read settings `trigger` (`titleEvent` or `hook`), `hookScope` (`workspace` or `user`), `activationPatterns` (string array), `worktreePrefixes` (string array of prefixes including their connector, default empty) and `renameExistingDays` (non-negative integer, default 7, 0 = off) from a configurable section, falling back to defaults for unknown values; an empty `activationPatterns` array SHALL turn patterns off. A host extension SHALL be able to supply the same options, for example from `variants.yaml` (`chatRenamer`). When embedded in Variant, `worktreePrefixes` SHALL default to the workspace's `variant.prefix`, so the prefix is defined once; an explicit `chatRenamer.worktreePrefixes` replaces that default rather than adding to it. An option the user set explicitly in the editor settings SHALL win over the host-supplied value, which SHALL win over the default. A host extension SHALL be able to choose the command prefix and settings section, and SHALL contribute the settings in its own manifest. Changing the settings SHALL reconfigure the trigger without a reload. When `worktreePrefixes` is empty, the default path pattern SHALL derive a title from a dragged-in path. When `worktreePrefixes` is non-empty, only those prefixes SHALL match `@` paths.

#### Scenario: Standalone defaults

- **WHEN** the standalone extension activates
- **THEN** commands `chat-renamer.renameChat`, `chat-renamer.renameChatFromPrompt` and `chat-renamer.renameActiveChat` are registered and settings are read from `chat-renamer.*`

#### Scenario: Embedded in Variant

- **WHEN** `variant-vscode` activates
- **THEN** commands `variant-worktrees.renameChat`, `variant-worktrees.renameChatFromPrompt` and `variant-worktrees.renameActiveChat` are registered and settings are read from `variant-worktrees.chatRename.*`

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
- **THEN** the embedding host manifest contributes the same setting under its own section
