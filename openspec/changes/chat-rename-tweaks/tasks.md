## 1. Numbering

- [ ] 1.1 Add failing tests in `packages/chat-renamer-api/src/chat-title-numbering.spec.ts` and `cursor-chat-rename.spec.ts`: `abc7` beside `abc` stays `abc7` and a chat already titled `abc7` is not renamed; a chat titled `New Chat` with pattern title `abc7` beside `abc` is renamed `abc7`; `abc` beside `abcd` and `other` stays `abc` and a chat already titled `abc` is not renamed; a chat titled `New Chat` with pattern title `abc` beside those peers is renamed `abc`. `abc`+`abc` → `abc2` and `def`+`def3`/`def5` → `def6` stay. Verify the new tests fail.
- [ ] 1.2 Keep a candidate that already has trailing digits in `numberedTitle` and leave the existing-chats plan alone. Verify the tests from 1.1 pass.

## 2. Default path pattern

- [ ] 2.1 Add failing tests: `chat-renamer-config` defaults list the path pattern then the slug pattern; `findRenameRequest` on `/vw-spec-iterate @/Users/me/_v-outer/_v-inner` and on `@/Users/me/vw/_v-cursor-chat-win-rename/` yields `inner` and `cursor-chat-win-rename` with default patterns and an empty prefix list; prefixes `["_v-"]` still yield no request for `_work-my-slug`. Verify the new tests fail.
- [ ] 2.2 Export the path pattern from `chat-renamer-config`, put it first in `DEFAULT_ACTIVATION_PATTERNS`, and omit that source when `worktreePrefixes` is non-empty. Verify the tests from 2.1 pass, including hook-script pattern compilation if a test already renders the script.
- [ ] 2.3 Add a failing then passing `chat-renamer-vscode` test that a standalone host with no `worktreePrefixes` renames `/vw-spec-iterate @/Users/me/_v-outer/_v-inner` to `inner`, and that Variant with prefix `_work-` still ignores `_v-my-slug`. Verify that test passes.

## 3. Active chat command

- [ ] 3.1 Add failing tests: manifests contribute `chat-renamer.renameActiveChat` titled `Chat Renamer: Rename active chat` and `variant-worktrees.renameActiveChat` titled `Variant: Rename active chat`; both ids are registered, including on an idle instance; a selected chat whose first prompt is `/vw-spec-start abc` and older than 30 seconds is renamed `abc` even when `renameExistingDays` is 0; no selected chat and a prompt of `fix the build` do not rename and tell the user. Verify the new tests fail.
- [ ] 3.2 Register `renameActiveChat`, resolve the selected chat as the first `composer.getOrderedSelectedComposerIds` id, and run the title-event path with no age window. Verify the tests from 3.1 pass.

## 4. Package output

- [ ] 4.1 Point `chat-renamer-vscode`'s `vsce-package` at `../../out` with `--no-dependencies`, and ignore `out/` in the root `.gitignore`. Verify the script writes `out/chat-renamer-vscode-0.0.1.vsix` and `git check-ignore` matches `out/`.

## 5. Wording

- [ ] 5.1 Update the activation-pattern setting text and the chat-renamer README so they describe the path pattern and that a typed trailing number is kept. Verify the manifest default array matches `DEFAULT_ACTIVATION_PATTERNS`.

## 6. Validation

- [ ] 6.1 Run `openspec validate chat-rename-tweaks --type change --strict --no-interactive` and the chat-renamer package tests. Verify both pass.
