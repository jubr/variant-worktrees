## Why

The awake poll point-reads the first composers in pane order. A live turn further down that list never opens, and a missing agent transcript does not fill the gap, so the Mac is not held awake for that turn.

## What Changes

- While `awake.when` is `chatsActive`, each sample takes the first 20 ids from this workspace's last-focused composer list and point-reads those composer rows. Pane order is not the list.
- A focused row that is in a turn counts, including tool work stored as aborted with `unfinishedRunAt` set. The first such row makes the sample active. The sample then stops and does not walk session files.
- When none of those 20 rows is active, a session file touched within the fresh window under a workspace folder open in this host still counts, as it does today.
- A selected chat outside those 20 focused ids does not count on its own.

## Capabilities

### New Capabilities

### Modified Capabilities

- `chat-renamer/awake`: which composer ids a host examines for an active turn.

## Impact

- `chat-renamer-vscode` activity sample: the id list comes from this workspace's composer state (`composer.composerData`, field `lastFocusedComposerIds`), then the existing point-read of `composerData:<id>` in the shared composer store. `chat-renamer-api` keeps the status predicate and the 20-id cap.
- Docs and changelogs that say which chats hold the machine awake: `docs/chat-renamer/index.md`, `docs/chat-renamer/configuration.md`, the chat-renamer README, and the root, `packages/chat-renamer-vscode`, and `packages/variant-vscode` changelogs.
- No new setting, package dependency, or `caffeinate` argument change.

Out of scope: listening to Cursor's agent-host turn watcher (`createAgentHostTurnWatcher` is limited to the built-in `anysphere.cursor-retrieval` extension, reports start and settled only, and does not replace the composer status read for tool work). An in-process SQL API for `state.vscdb` (extensions have none; storage mementos are per extension). Scanning every selected composer, unioning pane order back in, or changing rename triggers, grace, or `awake.when` / `awake.what` / `awake.graceDelaySecs`.
