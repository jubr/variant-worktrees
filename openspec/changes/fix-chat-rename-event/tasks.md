## 1. Read the first prompt from both store layouts

- [ ] 1.1 Add failing tests in `packages/chat-renamer-api/src/chat-first-prompt.spec.ts` for [specs/chat-renamer/chat-renaming | The first prompt is read from either Cursor chat store layout](../../specs/chat-renamer/chat-renaming/spec.md#requirement-the-first-prompt-is-read-from-either-cursor-chat-store-layout): newer layout, older layout, newer layout wins, and no human message in either. Verify they fail first.
- [ ] 1.2 In `packages/chat-renamer-api/src/chat-first-prompt.ts` look up the first human header in the `composerConvHeaders:<id>:` rows first and fall back to `composerData:<id>`. Verify `bun test packages/chat-renamer-api` passes.
- [ ] 1.3 Run the reader against the local Cursor store for a chat created on the newer layout and verify it returns the prompt text and a submit time, and that the query returns in well under the 3 s `sqlite3` timeout.

## 2. Verify

- [ ] 2.1 Run `task lint`, `task build`, `task test` and `openspec validate --all --strict --no-interactive`.
