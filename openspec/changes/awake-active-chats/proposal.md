## Why

The awake poll point-reads the first composers in pane order. A live turn further down that list never opens, and a missing agent transcript does not fill the gap, so the Mac is not held awake for that turn. The editor emits turn boundaries. Awake should follow those events, and a slow poll of the focused composers should catch a turn the events miss.

## What Changes

- While `awake.when` is `chatsActive`, the owning host subscribes to Cursor's agent-host turn watcher. A turn start marks this host active. A turn end marks that turn idle. The host stays active until every watched turn has ended and the poll agrees the focused composers are idle, then the existing grace delay applies.
- Every 5 seconds the host point-reads the first 20 ids in this workspace's last-focused composer list. A turn there counts even when the watcher said nothing, including tool work stored as aborted with the turn still unfinished. Pane order is not the list. Session files are not read. A missing watcher still polls.
- The startup info line `[awake] caffeinate available` also names the detection method: `agentHost+poll` when the watcher was created, `poll` when it was not.
- Watcher start and end lines are high-volume. They emit at trace only when `awake.agentHostEvents` is checked. The new setting `variant.log.highVolumeCategories` (standalone `chat-renamer.log.highVolumeCategories`) is a checkbox list, default empty. An unchecked entry does not emit at any level. `awake.ts` registers `awake.agentHostEvents` with `variant-log`, and the settings UI lists the registered ids.

## Capabilities

### New Capabilities

### Modified Capabilities

- `chat-renamer/awake`: turn-watcher events plus a 5-second poll of the first 20 last-focused composers, and the startup line names the detection method.
- `variant-log/events`: callers register high-volume categories, and an unchecked category does not emit.

## Impact

- `chat-renamer-vscode` awake path: subscribe to `cursor.createAgentHostTurnWatcher`, and poll the focused composers every 5 seconds. `chat-renamer-api` registers the high-volume category and keeps the caffeinate controller. `variant-log` holds the category registry. Both extension manifests gain the checkbox setting. `chat-renamer-api` depends on `variant-log`.
- Docs and changelogs that say which chats hold the machine awake, and the log setting: `docs/chat-renamer/index.md`, `docs/chat-renamer/configuration.md`, the chat-renamer README, and the root, `packages/chat-renamer-vscode`, and `packages/variant-vscode` changelogs.
- No `caffeinate` argument change. `awake.when`, `awake.what`, and `awake.graceDelaySecs` stay as they are.

Out of scope: a second client of `agent.v1.AgentHostService` (`watchTurns`, `watchSessionInteractions`, `watchSessionBackgroundWork`). That stream stays inside Cursor's agent host. The workbench already reduces it to start and settled before an extension sees it. VS Code's public chat APIs are not that service. Also out of scope: pane-order polling, session-file walks for awake, a `variants.yaml` key for the log categories, and any change to rename triggers.
