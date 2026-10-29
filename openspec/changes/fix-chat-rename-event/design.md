## Context

`readFirstPrompt` in `packages/chat-renamer-api/src/chat-first-prompt.ts` runs two read-only `sqlite3` queries against Cursor's `state.vscdb` (table `cursorDiskKV`): the first `type = 1` (human) entry of `composerData:<id>` → `fullConversationHeadersOnly`, then the text of `bubbleId:<id>:<bubbleId>`. `readFirstPromptWithRetry` repeats that six times, 500 ms apart, because Cursor may write the rows after the title event. The title event decision (`catalogTitleDecision`) reads the prompt before it looks at any rule, so an unreadable prompt ends as `ignore` / `no first prompt` after about 2.5 s, before `titleEventPromptLines` is consulted.

Observed on a current Cursor build (record version `_v: 18`): `composerData:<id>` has `fullConversationHeadersOnly: []`, also long after the chat completed. The same headers sit in rows `composerConvHeaders:<id>:000000`, `:000001`, ...; each value is a JSON array of header objects `{bubbleId, type, createdAt, ...}`, in message order. The bubble rows `bubbleId:<id>:<bubbleId>` are unchanged, and the first human header has the same `bubbleId` and `createdAt` as before. The new headers carry no `grouping.textPreview`, so the preview fallback does not apply to them.

## Goals / Non-Goals

**Goals:**

- Read the first prompt on both layouts with the same result shape (`text`, `submittedAtMs`).
- Keep the two-query cost: no scan of the table, only exact key lookups or a key range of one chat.

**Non-Goals:**

- Detecting the Cursor version. The layout is detected by what the store holds.
- Changing the retry budget, the 30 s age limit, or the decision log.

## Decisions

- **Header lookup by key range, newer layout first.** One query takes `composerConvHeaders:<id>:` rows in key order, expands each array with `json_each`, and returns the first `type = 1` entry. Zero rows fall through to the existing `composerData` query. Chunk keys are zero-padded, so key order is message order and the first human message is in the first chunk that has one. Alternative: query `composerData` first. Rejected because on the new layout that query always comes back empty, and each of the six attempts would pay for it before the real lookup.
- **Single code path after the header.** Both queries return the header JSON; the bubble text lookup and `parseFirstPrompt` stay as they are. Alternative: a second parser for the new header. Rejected: the fields used (`bubbleId`, `createdAt`, optional `grouping.textPreview`) are the same.
- **Chat id guard stays.** `SAFE_ID` already restricts the id that goes into SQL; the key prefix is built from the same checked id, so no new injection surface.
- **Retry unchanged.** The new rows are written at the same moment as the bubble (observed: header `createdAt` one second before the title event), so the existing budget is enough.

## Risks / Trade-offs

- [Cursor changes the store layout again] → The reader already returns `undefined` on any failure and the decision logs `no first prompt`; the fallback keeps the old layout working. A later change can add a layout.
- [A long chat splits headers over many chunks] → Only the first chunk with a human header is needed, and the key range is scoped to one chat id, so the query stays cheap on a large store.
- [`LIKE` or range scans slow on a multi-GB store] → Use an exclusive upper bound on the key (`>= 'composerConvHeaders:<id>:'` and `< 'composerConvHeaders:<id>;'`) so SQLite uses the unique key index; measure with the real store while implementing.
