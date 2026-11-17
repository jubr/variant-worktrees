## Why

`awake.cmd` is a setting, but the awake spec lets only `/usr/bin/caffeinate -disu -w ${extensionHostPid}` start a process. Any other value is silently ignored, so a user who points `awake.cmd` at another keep-awake program, or at `caffeinate` with other flags, gets no process and no explanation.

## What Changes

- The extension tries to execute whatever `awake.cmd` says, split on whitespace into a program and arguments, with `${extensionHostPid}` replaced. The default stays `/usr/bin/caffeinate -disu -w ${extensionHostPid}`.
- **BREAKING (spec only)**: "any other `awake.cmd` SHALL NOT start a process" is removed. A custom command now runs, and when the host is killed without dispose it lives only as long as the command itself waits on `${extensionHostPid}`.
- A command that cannot be executed, or that exits within 1 second of starting, is a failed start. The log gets one `[awake]` warn line for that command, once per distinct command for the life of the owner. Later failures of the same command stay out of warn and above. The extension keeps running and tries again on the next observation of activity.
- The first time the owner has `awake.when` `chatsActive`, the extension tries `awake.cmd` right away as a startup probe, without waiting for a chat. A failure is therefore logged straight after the `[awake] caffeinate available …` line, not minutes later at the first turn. A probe with no active session is killed 1 second after it started (reason `probe`). It runs once per owner. The default command is not probed when `caffeinate` is unavailable.
- Changing `awake.cmd` while a session is active kills the tracked process and, once it has exited, starts the new command. Today it kills and starts nothing.
- The startup `caffeinate` availability check still gates the default command only. A custom command is tried even when `caffeinate` is missing, so a non-macOS user can set their own.
- The start debug line quotes the command that was run, not only `caffeinate`.

## Capabilities

### New Capabilities

### Modified Capabilities

- `chat-renamer/awake`: which `awake.cmd` values start a process, what counts as a failed start and how it is logged, and what an `awake.cmd` change does while a session is active.

## Impact

- `chat-renamer-api` awake controller (the command gate, the failed-start path, the replacement on change) and its spec; `chat-renamer-vscode` `spawnCaffeinate`, which must report an asynchronous spawn error instead of leaving it unhandled.
- Setting descriptions for `chat-renamer.awake.cmd` and `variant.awake.cmd`, `docs/chat-renamer/index.md`, `docs/chat-renamer/configuration.md`, `packages/chat-renamer-vscode/README.md`, and the changelogs.
- No new dependency, no setting added, no default changed. The `chat-renamer-config` schema already accepts any non-blank `cmd`.

Out of scope: shell quoting or shell features in `awake.cmd`, an argument array form, retry backoff, and any change to when a session counts as active or to `awake.when` and `awake.graceDelaySecs`.
