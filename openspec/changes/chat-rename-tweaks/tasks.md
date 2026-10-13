## 1. Numbering

- [x] 1.1 Add failing tests in `packages/chat-renamer-api/src/chat-title-numbering.spec.ts` and `cursor-chat-rename.spec.ts`: `abc7` beside `abc` stays `abc7` and a chat already titled `abc7` is not renamed; a chat titled `New Chat` with pattern title `abc7` beside `abc` is renamed `abc7`; `abc` beside `abcd` and `other` stays `abc` and a chat already titled `abc` is not renamed; a chat titled `New Chat` with pattern title `abc` beside those peers is renamed `abc`. `abc`+`abc` → `abc2` and `def`+`def3`/`def5` → `def6` stay. Verify the new tests fail.
- [x] 1.2 Keep a candidate that already has trailing digits in `numberedTitle` and leave the existing-chats plan alone. Verify the tests from 1.1 pass.

## 2. Default path pattern

- [x] 2.1 Add failing tests: `chat-renamer-config` defaults list the path pattern then the slug pattern; `findRenameRequest` on `/vw-spec-iterate @/Users/me/_v-outer/_v-inner` and on `@/Users/me/vw/_v-cursor-chat-win-rename/` yields `inner` and `cursor-chat-win-rename` with default patterns and an empty prefix list; prefixes `["_v-"]` still yield no request for `_work-my-slug`. Verify the new tests fail.
- [x] 2.2 Export the path pattern from `chat-renamer-config`, put it first in `DEFAULT_ACTIVATION_PATTERNS`, and omit that source when `worktreePrefixes` is non-empty. Verify the tests from 2.1 pass, including hook-script pattern compilation if a test already renders the script.
- [x] 2.3 Add a failing then passing `chat-renamer-vscode` test that a standalone host with no `worktreePrefixes` renames `/vw-spec-iterate @/Users/me/_v-outer/_v-inner` to `inner`, and that Variant with prefix `_work-` still ignores `_v-my-slug`. Verify that test passes.

## 3. Active chat command

- [x] 3.1 Add failing tests: manifests contribute `chat-renamer.renameActiveChat` titled `Chat Renamer: Rename active chat` and `variant.renameActiveChat` titled `Variant: Rename active chat`; both ids are registered, including on an idle instance; a selected chat whose first prompt is `/vw-spec-start abc` and older than 30 seconds is renamed `abc` even when `renameExistingDays` is 0; no selected chat and a prompt of `fix the build` do not rename and tell the user. Verify the new tests fail.
- [x] 3.2 Register `renameActiveChat`, resolve the selected chat as the first `composer.getOrderedSelectedComposerIds` id, and run the title-event path with no age window. Verify the tests from 3.1 pass.

## 4. Package output

- [x] 4.1 Point `chat-renamer-vscode` and `variant-vscode` `vsce-package` at `../../out/chat-renamer-${npm_package_version}.vsix` and `../../out/variant-worktrees-${npm_package_version}.vsix` with `--no-dependencies`, drop `variant-vscode`'s `files` field so `vsce` accepts `.vscodeignore`, and ignore `out/` in the root `.gitignore`. Verify the scripts write `out/chat-renamer-0.0.1.vsix` and `out/variant-worktrees-0.0.1.vsix`, and `git check-ignore` matches `out/`.

## 5. Wording

- [x] 5.1 Update the activation-pattern setting text and the chat-renamer README so they describe the path pattern and that a typed trailing number is kept. Verify the manifest default array matches `DEFAULT_ACTIVATION_PATTERNS`.

## 6. Rename action log

- [x] 6.1 Add failing tests: a pattern rename logs the chat id, the reason, and the final title for `abc` beside `abc` (`numbered against open chats`, `abc2`), `New Chat` + `abc7` beside `abc` (`typed trailing number kept`, `abc7`), and `New Chat` + `abc` beside `abcd` and `other` (`no shared base`, `abc`); a chat already titled `abc7` logs `current title shares the base` and `abc7` and is not renamed; `/chat-rename abc` beside `abc` logs `slash command` and `abc`; an existing-chats rename line starts with `[existing-chats]` and contains `existing chats plan` and the final title. Verify the new tests fail.
- [x] 6.2 Log `rename <id>: <reason>; title <json>` from the title decision, and add `existing chats plan` to the existing-chats rename line. Verify the tests from 6.1 pass.

## 7. Validation

- [x] 7.1 Run `openspec validate chat-rename-tweaks --type change --strict --no-interactive` and the chat-renamer package tests. Verify both pass.
