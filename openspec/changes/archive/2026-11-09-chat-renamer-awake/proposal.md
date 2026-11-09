## Why

A long Cursor chat turn lets the Mac sleep: the display locks and the system idles while the agent is still generating or calling tools. The renamer already sits in the editor for the life of those chats and can hold the machine awake for that stretch only, then release it.

## What Changes

- New settings `awake.when` (`chatsActive` default, or `never`), `awake.what` (`screen` default, or `cpu`), and `awake.graceDelaySecs` (non-negative integer, default 60). Standalone keys are `chat-renamer.awake.when`, `chat-renamer.awake.what`, and `chat-renamer.awake.graceDelaySecs`. Embedded in Variant they are `variant.awake.when`, `variant.awake.what`, and `variant.awake.graceDelaySecs`. `variants.yaml` carries them under `chatRenamer.awake.when`, `chatRenamer.awake.what`, and `chatRenamer.awake.graceDelaySecs`. Editor values the user set win over the file, which wins over the defaults. Unknown values fall back to the defaults. Changes apply without a reload.
- While `awake.when` is `chatsActive`, one `caffeinate` child runs for as long as at least one chat session is active, and for `awake.graceDelaySecs` after the last one goes idle. Active means the session is taking a turn or generating output, including tool work that belongs to that turn. An open, selected, or idle chat is not active. Activity during the delay keeps the same process and cancels the delay. `screen` runs `caffeinate -disu`. `cpu` runs `caffeinate -dis`. The extension tracks that single pid: it starts the process when activity begins, kills it when the delay elapses, replaces it when `awake.what` changes, and starts it again if it exits while a session is still active. `never`, disposal, and loss of ownership kill it at once and do not wait.
- `awake.when` `never` never starts the process and kills one that is already running. Disposal and loss of the single-owner claim do the same. `variant.enable` does not turn this off.
- On startup the owner checks once whether `caffeinate` can be run and logs that at info. If it cannot, no process is started and the line is not repeated. Delay start, cancel, and elapse are logged at trace only.

Out of scope: sleep inhibition on Linux or Windows, a `hooks.json` entry for this feature, keeping the machine awake for idle chats, and any change to rename triggers.

## Capabilities

### New Capabilities

- `chat-renamer/awake`: when the renamer starts and kills one `caffeinate` process from chat-session activity, the grace delay, and the three settings.

### Modified Capabilities

- `chat-renamer-config/defaults`: the shared option set gains `awake.when`, `awake.what`, and `awake.graceDelaySecs`, their allowed values, and their defaults.

## Impact

- `chat-renamer-config` schema and defaults; `chat-renamer-api` settings read; `chat-renamer-vscode` activation, both manifests (`chat-renamer.*` and `variant.*`), and tests that fake the activity source and the child process.
- Docs and changelogs that list chat-renamer settings: `docs/chat-renamer/configuration.md`, the chat-renamer overview, the package READMEs, `variants.example.yaml`, and `CHANGELOG.md` entries.
- No new package dependency. `caffeinate` is the macOS system binary. The existing one-owner rule decides which embedded instance may spawn it.
