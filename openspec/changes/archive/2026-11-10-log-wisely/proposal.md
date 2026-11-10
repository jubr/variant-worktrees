## Why

Variant logs are noisy in the wrong places and quiet in the wrong ones. Unit tests that keep a variant under a temporary directory still emit info lines into the editor channel. A `list` prints three lines that say nothing but that it listed. Shell commands are shown as bare text or as `cmd="..."`, while the checkout you are standing in is stamped on events that belong to the variant named with `-s`. A few routine lines (awake kill, a successful rename decision) sit above the level where they are useful.

## What Changes

- When a variant directory is a known temporary directory, or a directory inside one, every log event for that variant is emitted at `trace`, whichever level the call site asked for. The known directories are `/tmp`, `/private/tmp`, `/var/folders`, `/var/tmp`, and the process temporary directory. Default CLI, MCP, and editor views then stay quiet during unit tests.
- `list` emits no log event. The messages `list`, `listing variants`, and `listed variants` are not written.
- On the Variant Worktrees channel, an event from the CLI ends with ` @cli` and an event from MCP ends with ` @mcp`. **BREAKING** for a reader that matches ` [cli]` or ` [mcp]`.
- A shell command in the log is the message `+"<command>"` (plus, then the command in quotes, no space). That replaces a bare command such as `printf seeded` and the channel form `cmd="mise trust --all"`. **BREAKING** for a reader that matches `cmd=`. Schema lines such as `create schema …` stay plain sentences.
- The five log levels are one exported enum, values `trace`, `debug`, `info`, `warn`, `error`, in that order. The strings on a log line and on the socket stay those words. `warning` still selects `warn` on the CLI.
- Starting and killing the awake `caffeinate` process are logged at `debug`.
- A command run with an explicit slug (CLI `-s` / `--slug`, or the slug a tool call names) stamps that slug on events that would otherwise take the working-directory slug. `variant implode -s release-smoke` from the primary checkout logs `<release-smoke>`, including branch removal and `implode finished`.
- A title-event decision whose reason is `rename request` is logged at `debug`.

Non-goals: no user setting for the temporary-directory list; the awake start line stays `+ "caffeinate …"` with a space and its pid and reason; command stdout that echoes `+ command` is unchanged; other title-event decision reasons keep their levels; `list` results and `--verbose` stay as they are; `--log-level` values stay as they are.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `variant-log/events`: the shared levels are one enum.
- `variant-api/logging`: temporary directories force `trace`; listing is not logged; shell commands use `+"<command>"`.
- `variant-api/implode`: branch and finish events carry the variant slug, and drop to `trace` when that directory is temporary.
- `variant-cli/logging`: stderr shows the quoted command; an explicit slug fills an event that has none; stderr still has no origin mark.
- `variant-mcp/logging`: notification data has no ` @mcp`.
- `variant-vscode/ipc-endpoint`: channel text uses `+"<command>"` and ends with ` @cli` or ` @mcp`.
- `chat-renamer/awake`: kill is `debug`.
- `chat-renamer/chat-renaming`: a `rename request` decision is `debug`.

## Impact

- `packages/variant-log` (enum), `variant-api` (emit path, list, provision, seed, mise, implode), `variant-cli` (stderr text and slug fill-in), `variant-mcp` (the forbidden suffix), `variant-vscode` (channel format and the socket log request), `chat-renamer-api` (awake kill, title decision). `variant-vscode` picks up the renamer through the shared packages.
- Log lines that tests and the README / `docs/guide/core.md` describe. `CHANGELOG.md` records the line-format and level changes.
- No new command, flag, or dependency. Socket `log` requests still carry `level`, `message`, `step`, `slug`, and `origin`.
