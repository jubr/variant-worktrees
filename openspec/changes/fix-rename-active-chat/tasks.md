## 1. Choose the active chat

- [x] 1.1 Add failing unit tests for `chooseActiveChat` in `packages/chat-renamer-vscode/src/active-chat.spec.ts` for [specs/chat-renamer/chat-renaming | Rename the active chat on command](../../specs/chat-renamer/chat-renaming/spec.md#requirement-rename-the-active-chat-on-command): strings and `composerId`/`sessionId`/`id` objects count and other values are ignored; the newest `updatedAt` among selected chats wins; the first selected id wins a tie and wins when the catalog lists none; a missing or non-finite `updatedAt` ranks below a number; an empty selection picks the newest catalog chat; no selection and no catalog yields rule `none`. Verify they fail.
- [x] 1.2 Implement `chooseActiveChat(selection, catalog)` in `packages/chat-renamer-vscode/src/active-chat.ts`, returning the chosen id, the rule (`newest selected`, `first selected`, `newest in catalog`, `none`), the ids that counted and the chats that took part. Verify `bun test packages/chat-renamer-vscode/src/active-chat.spec.ts` passes.

## 2. Wire the command and log it

- [x] 2.1 Add failing tests in `packages/chat-renamer-vscode/src/trigger.test.ts` (`renameActiveChat` block) for the scenarios `Several selected chats`, `Selected chat the catalog does not list`, `Selected ids as objects`, `No selected chat falls back to the newest chat`, `No selected chat` (the user is told, nothing renamed) and a catalog that throws. Verify they fail.
- [x] 2.2 Add failing tests for [specs/chat-renamer/chat-renaming | Rename active chat explains itself in the log](../../specs/chat-renamer/chat-renaming/spec.md#requirement-rename-active-chat-explains-itself-in-the-log): a recording log sink at trace level shows `[active-chat] selection`, `catalog` and `chosen` with the field values from the spec scenarios, `warn` entries `not renamed reason="no chat found"` and `reason="no rename request"`, and an `info`-level sink shows none of the trace entries. Verify they fail.
- [x] 2.3 Use `chooseActiveChat` in `commands.ts` for `renameActiveChat`: read the selection and the catalog (a catalog failure logs a warning and counts as empty), log through `log.child("active-chat")` as the spec says, write the `not renamed` warn entry before each notification, and pass the chosen chat and its catalog title to `catalogTitleDecision` with `decisionLog`. Verify the tests from 2.1 and 2.2 and the existing `renameActiveChat` tests pass.

## 3. Docs, validation and packages

- [x] 3.1 Update `packages/chat-renamer-vscode/README.md`, `docs/chat-renamer/index.md` and, where it names the command, `packages/variant-vscode/README.md` to say how the active chat is chosen and that the `active-chat` trace entries show the choice. Verify with `rg "active chat" docs packages/*/README.md` that the wording is consistent.
- [x] 3.2 Run `task lint`, `task test`, `task build`, `openspec validate --all --strict --no-interactive`, and `task check:full`. Verify each passes.
- [x] 3.3 Run `task version:incr:patch`, then `task package:vsix`, and verify `out/` holds non-empty `variant-worktrees-<version>.vsix` and `chat-renamer-<version>.vsix` with the bumped version, and `task release:version` passes.
