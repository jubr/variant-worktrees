## 1. Read the first prompt from both store layouts

- [ ] 1.1 Add failing tests in `packages/chat-renamer-api/src/chat-first-prompt.spec.ts` for [specs/chat-renamer/chat-renaming | The first prompt is read from either Cursor chat store layout](../../specs/chat-renamer/chat-renaming/spec.md#requirement-the-first-prompt-is-read-from-either-cursor-chat-store-layout): newer layout, older layout, newer layout wins, newer layout fails (sqlite error and unparsable output), and no human message in any layout. Verify they fail first.
- [ ] 1.2 In `packages/chat-renamer-api/src/chat-first-prompt.ts` look up the first human header in the `composerConvHeaders:<id>:` rows first and fall back to `composerData:<id>`, each method isolated so a failure of the first never skips the second. Verify `bun test packages/chat-renamer-api` passes.
- [ ] 1.3 Run the reader against the local Cursor store for a chat created on the newer layout and verify it returns the prompt text and a submit time, and that the query returns in well under the 3 s `sqlite3` timeout.

## 2. Diagnose an unreadable first prompt

- [ ] 2.1 Add failing tests in `chat-first-prompt.spec.ts` for `probeFirstPromptStore`: it returns `record`, `listedHeaders` and `headerRows` for each layout, `record` `missing` for an unknown chat, sets `error` when a query fails, and never throws. Verify they fail first, then implement it in `chat-first-prompt.ts` and export it. Verify `bun test packages/chat-renamer-api` passes.
- [ ] 2.2 Add failing tests in `packages/chat-renamer-vscode/src/trigger.test.ts` for [specs/chat-renamer/chat-renaming | An unreadable first prompt of a new chat is diagnosed and announced](../../specs/chat-renamer/chat-renaming/spec.md#requirement-an-unreadable-first-prompt-of-a-new-chat-is-diagnosed-and-announced): first chat (trace entry `attempt=1` and one warning), second chat (`attempt=2`, no notification), sixth chat (no entry), another ignore reason (nothing), and a readable chat after an unreadable one (renamed). Verify they fail first.
- [ ] 2.3 In `packages/chat-renamer-vscode/src/trigger.ts` count chats ignored with reason `no first prompt`, write the `unreadable` trace entry for the first 5 using the probe, and show the warning for the first. Verify `bun test packages/chat-renamer-vscode` passes.

## 3. Verify

- [ ] 3.1 Run `task lint`, `task build`, `task test` and `openspec validate --all --strict --no-interactive`.
