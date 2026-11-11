## Context

See proposal.md for why. The awake controller in `chat-renamer-api` tracks one child and asks a spawn function for the assertion flags as one string, `-disu` or `-dis`. `chat-renamer-vscode` runs `spawn("caffeinate", [args], { stdio: "ignore" })` and is not detached. On macOS a child is reparented to `launchd` when its parent dies; leaving it attached does not make it exit. `caffeinate -w <pid>` exits when that pid exits. An earlier design rejected `-w` because it does not stop when the chat goes idle. That idle stop stays an explicit kill. `-w` covers the path where the host never runs dispose.

Each extension host is its own process and claims the renamer on `globalThis`, so every window is an owner. The activity read unions the newest `composerHeaders` in the shared `state.vscdb` with this window's open composer ids, and on a missing headers table falls back to every `composerData:%` row. That boolean is OR'd with session-file freshness under this window's workspace folders. The header union and the unscoped fallback are what mark every host active. The session-file walk is already limited to folders open in this host.

## Goals / Non-Goals

**Goals:**

- The publisher's `active` boolean is true only for sessions of this host.
- The spawned argv waits on the extension host pid, and the debug start line quotes that argv.
- Tests still never spawn a real `caffeinate`.

**Non-Goals:**

- A cross-process lock, a machine-wide single child, or a sweep of `caffeinate` processes this extension did not start.
- Collecting children already reparented by older builds. They are not distinguishable from a `caffeinate` the user started.
- Changing the in-host owner claim, the grace timer, or the assertion flags.

## Decisions

### Activity is decided before the controller

The controller keeps a boolean. It does not learn about workspaces. `chat-renamer-vscode` sets `active` from two signals, either of which is enough:

- Point-reads of composer ids open in this host (`orderedSelectedComposers` of this window). Do not prepend the global newest-header ids. Do not fall back to `composerData:%`. A missing database, a failed read, or an empty open-id list is idle on this signal.
- Session-file freshness under workspace folders open in this host. Unchanged, and already per folder.

The 20-id point-read cap stays, and it applies only to this host's open ids. A turn whose composer id falls past the cap still counts when its session file under this workspace is fresh.

Alternative considered: filter `composerHeaders` by a workspace column. The header query has no workspace, and a shared newest-N list is the leak. Rejected. Alternative considered: one child for the whole app via a file lock. Two windows with their own active chats would then share one process, which is the opposite of a host waking for its own sessions. Rejected.

Two hosts that both have the same workspace open both see that workspace's session files and both may run a child. That is accepted. A host that does not have the folder open does not.

### `-w` is added, the idle kill stays

`spawn` receives an argv list, not one clustered string. For `screen` the list is `["-disu", "-w", "<host-pid>"]`. For `cpu` it is `["-dis", "-w", "<host-pid>"]`. The host pid is injected (`process.pid` at the vscode edge) so tests pass a fixed pid. The controller treats that full list as the arguments it compares, so a `what` change still replaces the child and a second session of the same host does not. The pid does not change for the life of the host, so it does not cause a restart loop.

`spawnCaffeinate` passes that list to `node:child_process` `spawn` with `stdio: "ignore"` and without `detached`. Idle, `never`, dispose, and loss of ownership still `SIGTERM` then `SIGKILL`. `-w` is the backstop when that kill never runs. The debug start line quotes the full argv, `+ "caffeinate -disu -w <host-pid>"` or `+ "caffeinate -dis -w <host-pid>"`, with the child pid and reason `activity`. Kill lines stay `+ "kill <pid>"` and do not repeat the command.

Alternative considered: a watchdog that polls the parent. `caffeinate` already implements `-w`. Rejected. Alternative considered: replacing the idle kill with `-w` alone. The child would then run until the host exits, including through idle chats. Rejected.

### Do not reap anyone else's child

Startup does not scan the process table and does not signal a `caffeinate` it did not spawn in this process. Orphans from older builds stay until the user stops them.

## Risks / Trade-offs

- [An open-id list longer than the point-read cap] → The cap drops only this host's ids. A live turn still counts through the session file under this workspace. A turn that is neither in the capped id list nor writing a session file in this workspace does not hold awake.
- [Cursor has no `composerHeaders` table] → Awake no longer scans every `composerData` row. Open-id point reads and this workspace's session files remain.
- [`-w` watches a pid that exits and is later reused] → The child exits when the original pid exits, before the id can be reused.
- [Two windows of one workspace] → Both may run a child while that workspace's session is active. A third window on another folder does not.
- [Orphans already under `launchd`] → Left in place. This change stops new ones.

## Migration Plan

No settings and no stored state. The next extension-host start uses the new read and the new argv. Rollback is the previous build. Children started by the new build exit with that host. Children already left behind are not collected.

## Open Questions

None.
