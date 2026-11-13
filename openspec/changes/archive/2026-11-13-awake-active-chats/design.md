## Context

See proposal.md for why. The awake controller in `chat-renamer-api` still sees only a boolean and logs `[awake] caffeinate available` once at info. Today `chat-renamer-vscode` sets that boolean from a one-second poll: pane-ordered selected composer ids, a point-read of the first 20 `composerData` rows, then session-file freshness.

Cursor's workbench watches `agent.v1.AgentHostService.watchTurns`. The extension host does not receive that stream. `cursor.createAgentHostTurnWatcher()` forwards only `started` and `settled`, as `{ sessionId, turnId }`. Creating it is limited to the built-in `anysphere.cursor-retrieval` extension. `variant-log` today is a level, a message, and an optional slug, step, and origin. It has no category registry. Chat-renamer logs through its own `Logger`, not through `variant-log`.

The last-focused id list is the workspace `state.vscdb` `ItemTable` key `composer.composerData`, field `lastFocusedComposerIds`. Composer row bodies stay in the shared `cursorDiskKV` table. There is no command for that list.

## Goals / Non-Goals

**Goals:**

- A turn watcher when it can be created, plus a poll every 5 seconds of the first 20 last-focused composers.
- The startup info line names `agentHost+poll` or `poll`.
- `awake.agentHostEvents` is registered with `variant-log` and shown as a checkbox. Unchecked, those traces are not written.

**Non-Goals:**

- Calling `watchTurns` or the other `AgentHostService` streams from this extension.
- A `variants.yaml` key for the categories.
- Session-file walks, pane-order ids, or a one-second poll.
- Changing `composerIsActive`.

## Decisions

### Watcher first, focused poll behind it

On owner startup, when `awake.when` is `chatsActive`, call `cursor.createAgentHostTurnWatcher()`. Borrow `anysphere.cursor-retrieval` for that synchronous call only, then restore our identity. Track open turns as `sessionId` + `turnId`. Start adds, end removes.

Separately, every 5 seconds, read `json_extract(value, '$.lastFocusedComposerIds')` from the workspace database beside `storageUri`, keep the first 20 safe ids, and point-read those rows in the global `cursorDiskKV` store with the existing predicate. One query for the capped list, not one process per id. No `storageUri`, a locked database, or bad JSON is an idle poll sample and does not throw out of the loop.

The host is active when the watcher set is non-empty or the latest poll sample is active. A watcher end while the poll still sees an unfinished focused row does not start the grace delay. A missing watcher leaves the set empty and the poll running. `awake.when` `never` disposes the watcher and stops the timer. Do not walk session files. Do not call `orderedSelectedComposers` for awake.

The startup info line stays one line. When the binary exists it is `[awake] caffeinate available method="agentHost+poll"` after a successful create, and `[awake] caffeinate available method="poll"` when create fails or the method is missing. The unavailable line stays `[awake] caffeinate unavailable` with no method. The method is not logged again when a later turn starts.

Alternative considered: poll only after the watcher fails. A `settled` event that arrives before tool work ends would then sleep. The 5-second focused poll is what catches that row. Rejected. Alternative considered: keep the one-second pane-order poll. That is the bug. Rejected.

### High-volume categories are a registry plus a checkbox list

`variant-log` exports `registerHighVolumeCategory(id)` and `listHighVolumeCategories()`. Ids are unique and listed in registration order. Loading `chat-renamer-api`'s awake module registers `awake.agentHostEvents`. `chat-renamer-api` gains a `variant-log` dependency. The build keeps it external, the same way it keeps `chat-renamer-config` external.

The setting is an array of strings whose item enum is the registered ids. VS Code renders that as a checkbox list. Default `[]`. Variant's key is `variant.log.highVolumeCategories`. The standalone manifest uses `chat-renamer.log.highVolumeCategories` with the same enum and default. A test imports the awake module, then fails if either manifest's enum differs from `listHighVolumeCategories()`.

An id that is not in the setting does not emit, at any channel level. The watcher start and end traces check `awake.agentHostEvents` before they write. Create success and create failure are the method on the info line, not this category. Changing the checkbox applies on the next event without a reload.

Alternative considered: filter the lines in the log channel after they are written. The user asked for a hard disable, so the sink is not called. Rejected. Alternative considered: a `variants.yaml` list. The opt-in is the settings UI. Rejected.

## Risks / Trade-offs

- [`settled` arrives before tool work ends] → The focused poll, within 5 seconds, still sees `unfinishedRunAt` and holds the child. The gap is at most one interval.
- [A generating chat outside the first 20 focused ids, with no watcher event] → Does not count.
- [Two windows of one workspace share `composer.composerData`] → Both polls can count that workspace's focused turn. A window that does not have the folder open does not.
- [Create throws] → Method is `poll`. The 5-second read still runs.
- [Identity borrow breaks on a Cursor update] → Same class of risk as the rename borrow. Awake falls back to the poll.
- [A new high-volume category is registered and the manifest enum is not updated] → The manifest test fails.

## Migration Plan

No stored state of ours. The new setting defaults to empty, so agent-host event traces stay off until checked. The next extension-host start uses the watcher and the 5-second poll. Rollback is the previous build, which polls pane order once a second. Children already running keep their existing `-w` lifetime.

## Open Questions

None.
