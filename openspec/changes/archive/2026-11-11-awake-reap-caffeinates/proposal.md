## Why

A Cursor window holds the Mac awake for every project's chats, not only its own, and the `caffeinate` child keeps running after that window's extension host dies. Sleep then stays blocked with no live session behind it.

## What Changes

- A host starts and keeps its one `caffeinate` child only while a chat session of that host is active (a turn or generation, including tool work of that turn), plus the existing grace delay after that host's own last session goes idle. A session in some other host's workspace does not count. Each host may run its own child when its own sessions are active. The in-host owner claim is unchanged: the idle copy in the same host still does not start one.
- The child is started with the existing assertion flags and also waits on the pid of the extension host that spawned it. When that host process exits, including a kill that never runs dispose, the child exits with it. Idle, `never`, dispose, and loss of ownership still kill it at once, as they do today.
- Settings, defaults, and what "active" means for a session do not change.

## Capabilities

### New Capabilities

### Modified Capabilities

- `chat-renamer/awake`: which sessions may start the child, and that the child exits when its parent host process exits.

## Impact

- `chat-renamer-vscode` activity read and `caffeinate` spawn; `chat-renamer-api` controller arguments and tests that fake the child. The activity read today unions the newest composer rows in the shared state database with this window's open composers and this window's workspace session files, so one project's turn marks every host active. The spawn today passes only `-disu` or `-dis` and does not wait on the host pid, so a dead host leaves the child reparented and running.
- Docs and changelogs that describe the `caffeinate` command and which chats hold the machine awake: the chat-renamer configuration doc, the package READMEs, `variants.example.yaml`, and the changelog entries.
- No new package dependency and no settings change. `caffeinate` stays the macOS system binary.

Out of scope: sleep inhibition on Linux or Windows, a machine-wide single `caffeinate`, killing a `caffeinate` this extension did not start, sweeping children already left behind by older hosts, and any change to rename triggers or to `awake.when` / `awake.what` / `awake.graceDelaySecs`.
