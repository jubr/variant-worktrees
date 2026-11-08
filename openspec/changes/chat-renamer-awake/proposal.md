## Why

A long Cursor chat turn lets the Mac sleep: the display locks and the system idles while the agent is still generating or calling tools. The renamer already sits in the editor for the life of those chats and can hold the machine awake for that stretch only, then release it.

## What Changes

- New settings `awake.when` (`chatsActive` default, or `never`) and `awake.what` (`screen` default, or `cpu`). Standalone keys are `chat-renamer.awake.when` and `chat-renamer.awake.what`. Embedded in Variant they are `variant.awake.when` and `variant.awake.what`. `variants.yaml` carries them under `chatRenamer.awake.when` and `chatRenamer.awake.what`. Editor values the user set win over the file, which wins over the defaults. Unknown values fall back to the defaults. Changes apply without a reload.
- While `awake.when` is `chatsActive`, one `caffeinate` child runs for as long as at least one chat session is active. Active means the session is taking a turn or generating output, including tool work that belongs to that turn. An open, selected, or idle chat is not active. `screen` runs `caffeinate -disu`. `cpu` runs `caffeinate -dis`. The extension tracks that single pid: it starts the process when activity begins, kills it when activity ends, replaces it when `awake.what` changes, and starts it again if it exits while a session is still active.
- `awake.when` `never` never starts the process and kills one that is already running. Disposal and loss of the single-owner claim do the same. `variant.enable` does not turn this off.
- On a system without `caffeinate` the extension does not spawn a process and logs that once.

Out of scope: sleep inhibition on Linux or Windows, a `hooks.json` entry for this feature, keeping the machine awake for idle chats, and any change to rename triggers.

## Capabilities

### New Capabilities

- `chat-renamer/awake`: when the renamer starts and kills one `caffeinate` process from chat-session activity and the two settings.

### Modified Capabilities

- `chat-renamer-config/defaults`: the shared option set gains `awake.when` and `awake.what`, their allowed values, and their defaults.

## Impact

- `chat-renamer-config` schema and defaults; `chat-renamer-api` settings read; `chat-renamer-vscode` activation, both manifests (`chat-renamer.*` and `variant.*`), and tests that fake the activity source and the child process.
- Docs and changelogs that list chat-renamer settings: `docs/chat-renamer/configuration.md`, the chat-renamer overview, the package READMEs, `variants.example.yaml`, and `CHANGELOG.md` entries.
- No new package dependency. `caffeinate` is the macOS system binary. The existing one-owner rule decides which embedded instance may spawn it.
