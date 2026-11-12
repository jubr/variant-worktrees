## Context

See proposal.md for why. The awake controller in `chat-renamer-api` still sees only a boolean. `chat-renamer-vscode` sets that boolean from `composer.getOrderedSelectedComposerIds` (pane order of every selected chat), keeps the first 20, and point-reads `composerData:<id>` in the shared `state.vscdb` beside global storage. A fresh session file under a workspace folder open in this host is OR'd in. `composerIsActive` already treats `unfinishedRunAt > 0` as active, including when `status` is `aborted`. The cap and the pane order are what drop a live turn. There is no command for the last-focused list. Cursor stores it on the workspace `state.vscdb` `ItemTable` key `composer.composerData`, field `lastFocusedComposerIds` (`storageService.store(..., scope workspace, target machine)`). Composer row bodies stay in the shared `cursorDiskKV` table.

## Goals / Non-Goals

**Goals:**

- The id list for the composer signal is the first 20 `lastFocusedComposerIds` for this workspace.
- One point-read of those ids. An active row skips the session-file walk. An idle row list still ORs session files.
- A failed or missing focus-list read stays inside the sample and degrades to the session-file signal.

**Non-Goals:**

- Subscribing to `cursor.createAgentHostTurnWatcher` or `onDidChangeAgentHostSessionCatalogTitle` for awake.
- A Cursor or VS Code API that runs SQL. Extension mementos cannot read `composer.composerData`.
- Changing `composer.getOrderedSelectedComposerIds` for rename, peer titles, or the active-chat command.
- Unioning pane order back in, raising the cap, or changing `composerIsActive`.
- Glass-window storage. That mode skips the workspace write of `composer.composerData`.

## Decisions

### Read the focus list from workspace state, then point-read the shared rows

The sample stops calling `orderedSelectedComposers`. It reads `select json_extract(value, '$.lastFocusedComposerIds') from ItemTable where key = 'composer.composerData'` from the workspace `state.vscdb` next to `context.storageUri` (same `dirname` pattern as the global database next to global storage). No workspace folder means an empty list. Parse the JSON array, keep ids that match the existing safe-id pattern, and take the first 20. Pass those ids to the existing point-read against the global `cursorDiskKV` rows. Do not load the rest of `composer.composerData`.

The same `sqlite3 -readonly -json` runner is the query path. There is no in-process handle: `workspaceState` and `globalState` are this extension's memento, and the workbench storage service is not on the extension API.

Alternative considered: keep pane order and raise the cap until the live chat fits. A long `IN` list is what the cap exists to avoid, and pane order still puts old chats first. Rejected. Alternative considered: union the first 20 focused ids with the first 20 pane ids. The miss is the order, and the second list reintroduces chats the focus window is meant to ignore. Rejected.

### Short-circuit after one query, not per id

Issue one point-read for the capped id list. `composerRowsActive` already stops at the first active row in that result. When that result is active, return before the session-file walk. When it is not, walk session files as today. Do not spawn `sqlite3` once per id: the idle sample, which is the common one, would pay up to 20 process starts.

`awake.when` `never` already skips the read in `shouldPoll`. No second short-circuit there.

A throw from the focus-list read must not escape the sample. The watch turns a thrown read into idle and drops the session-file OR. Catch it, use an empty id list, and continue.

### Do not listen for a turn event

Cursor's extension host exposes `cursor.createAgentHostTurnWatcher()` with `onDidStartTurn` and `onDidEndTurn`, payload `{ sessionId, turnId }`. The call is limited to the built-in `anysphere.cursor-retrieval` extension. End fires when the agent-host turn is `settled`. Tool work that stays `status: aborted` with `unfinishedRunAt` set would then look idle. `onDidChangeAgentHostSessionCatalogTitle` is a title change, used by rename, not a turn boundary. `composerEventService.fireDidSendRequest` stays inside the workbench. None of these replaces the composer status read. This change does not borrow the retrieval extension's identity to subscribe.

### Status predicate stays

`composerIsActive` already counts `unfinishedRunAt > 0` before it treats `aborted` as idle. The sample only has to pass the focused id through. No change to that function.

## Risks / Trade-offs

- [Focus list on disk lags the in-memory list until Cursor saves headers] → The id is written on focus, which is before a long tool run. A poll during that gap falls through to session files. No in-memory API exists to read the list sooner.
- [A generating chat outside the first 20 focused ids, with no fresh session file] → Does not count. Same cap as today, applied to focus order instead of pane order.
- [Workspace database locked or unreadable] → Composer signal idle, session files still apply. Same failure mode as today's selected-id command throwing.
- [Two windows of one workspace share `composer.composerData`] → Both may count that workspace's focused turn. Already accepted for session files of a shared folder.
- [Glass skips the workspace write] → The focus list is missing and the sample uses session files only. Not special-cased.
- [Cursor renames the storage key or drops `lastFocusedComposerIds`] → The list reads as empty and awake falls back to session files until this extension is updated.

## Migration Plan

No setting and no stored state of ours. The next extension-host start uses the new id list. Rollback is the previous build, which returns to pane order. Children already running keep their existing `-w` lifetime.

## Open Questions

None. The turn watcher and an in-process `state.vscdb` query are decided above.
