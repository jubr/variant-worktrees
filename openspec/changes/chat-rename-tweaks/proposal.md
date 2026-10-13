## Why

Packaging drops each `.vsix` inside its extension package, where it shows up as an untracked file. Two numbering outcomes rewrite or restate a title that should be left alone, and the default patterns miss a dragged-in worktree path unless a prefix is configured. There is also no palette command that renames the chat the user is in.

## What Changes

- Write every packaged `.vsix` to the repository root `out/` as `out/chat-renamer-<version>.vsix` and `out/variant-worktrees-<version>.vsix`, and ignore that directory in git.
- Add the palette command `Chat Renamer: Rename active chat`. The Variant host contributes the same command as `Variant: Rename active chat`.
- Stop rewriting a pattern title that already ends in digits (`abc7` with an open chat `abc` is not renamed to `abc2`).
- When a pattern title shares no base with the other open chats and the chat already holds that title (`abc` beside `abcd` and `other`), do not rename it.
- Add a default activation pattern for `/<word>-spec-<word> @<path>` so `@/Users/me/_v-outer/_v-inner` yields `inner` without a configured worktree prefix.
- Log each rename action with the reason the title was chosen and the final title.

## Capabilities

### New Capabilities

### Modified Capabilities

- `chat-renamer-vscode/chat-renaming`: package output path for every extension `.vsix`, the active-chat command, standalone path derivation when no worktree prefix is set, and a log line for each rename action.
- `chat-renamer-api/chat-rename-requests`: numbering outcomes for a typed trailing number and for a title with no shared base; the default path pattern.
- `chat-renamer-config/defaults`: the default `activationPatterns` list gains the path pattern.

## Impact

- `packages/chat-renamer-vscode` and `packages/variant-vscode` package scripts. `chat-renamer-vscode` manifest commands and command registration. `variant-vscode` contributes the embedded command.
- `packages/chat-renamer-api` numbering, pattern matching, and the reason attached to a rename. `packages/chat-renamer-config` default pattern list.
- Root `.gitignore` gains `out/`.
- No CLI, MCP, or database change.

## Non-goals

- Changing creation-order numbering of existing chats (`abc`, `abc2`, `abc3`, including a chat whose prompt yielded `abc7`).
- Changing slash-command titles, the `abc` + `abc` → `abc2` case, or the `def` + `def3`/`def5` → `def6` case.
- Publishing the extensions.
- A title prompt. The active-chat command reads the chat's first prompt.

## Assumptions

- `Chat Renamer: Rename active chat` is the standalone palette title. Embedded Variant uses `Variant: Rename active chat` and command id `variant-worktrees.renameActiveChat`, matching `Variant: Rename Existing Chats`.
- The active chat is the first id from `composer.getOrderedSelectedComposerIds`.
- "The chat is not renamed" for `abc7` beside `abc` means the renamer must not assign `abc2`. The typed title `abc7` is kept: a chat already titled `abc7` is left alone; a chat with a different title is renamed to `abc7`, not to `abc2`.
- "The chat is not renamed" for `abc` beside `abcd` and `other` means numbering adds no suffix, and a chat already titled `abc` is left alone. A chat whose current title is not yet `abc` is still renamed to `abc`, so a unique `/vw-spec-start abc` keeps working.
- A non-empty `worktreePrefixes` list stays authoritative: an unconfigured prefix still produces no title. The new default path pattern applies when that list is empty.
- The path pattern captures the last path segment after its leading `<token>-` prefix, so `_v-inner` yields `inner` and `_v-cursor-chat-win-rename` yields `cursor-chat-win-rename`. It does not hardcode `_v-`.
