## Why

CLI log lines are `level: message` with no color, and the step is buried in the message (`[create] + mise install`). The log stream lives inside `variant-api`, so `variant-ipc` and `variant-mcp` cannot emit the same events without depending on the lifecycle library. `variant --version` always prints the cursive drawing, including when stdout is a pipe.

## What Changes

- **BREAKING** The log stream moves to a new package, `variant-log`. An event is `level`, `message`, and optional `slug` and `step`. The message does not repeat the step in brackets. `logT`, `logD`, `logI`, `logW`, and `logE` emit one fixed level. `log` stays for a level chosen by the caller. No host attached drops the event. The package applies no color.
- `variant-api`, `variant-ipc`, and `variant-mcp` emit through that package. `variant-ipc` does not depend on `variant-api` to do so. A leading `[step]` that today sits in a message becomes the `step` field, and a slug that today sits in the message becomes the `slug` field.
- **BREAKING** A CLI log line is `[level] step message` when the event has a step, and `[level] message` when it does not. The displayed level words are `trace`, `debug`, `info`, `warn`, and `error`. `--log-level=warning` still selects `warn`. The slug is still not printed. When standard error is a terminal and `NO_COLOR` is unset, the brackets are dark gray, the level word has its own color, the step is cyan, and the message is the default terminal color. Otherwise the same characters have no ANSI sequences. Color stays in the CLI.
- The MCP logging notification carries `message`, and `step` and `slug` when the event has them. Trace still names the library level.
- The editor log channel reads `step` and `slug` from the event. It does not color the line.
- **BREAKING** `variant --version` prints the cursive drawing only when standard output is a terminal. A pipe omits the drawing and the blank line that followed it. On a terminal, orange coloring is unchanged.
- The CLI sends each log event to the editor on the project Unix socket. The connection starts at the first event, one attempt. Success emits one debug event, step `ipc`, message `connected`. Failure emits one debug event, step `ipc`, message `connect failed`. Neither is repeated. When the CLI finishes, it emits one debug event, step `cli`, message `end`. A missed socket does not change the command result. The editor writes a `log` request on the Variant Worktrees channel.

## Capabilities

### New Capabilities

- `variant-log/events`: the shared event, the optional step, and the level shorthands. Hosts attach a sink and format the event themselves.

### Modified Capabilities

- `variant-cli/logging`: the CLI line uses the event's `step` and the colors above. Threshold, stderr, and `-v` stay.
- `variant-api/logging`: events the library emits may carry `step` and `slug` as fields. The message does not repeat them.
- `variant-api/implode`: the debug branch line on the CLI starts with `[debug]`.
- `variant-ipc/unix-socket`: invalid requests and a live-socket refusal emit log events. The socket replies stay as they are.
- `variant-mcp/logging`: a notification's data includes `message`, `step`, and `slug`.
- `variant-api/commands`: the cursive `--version` drawing is printed only when standard output is a terminal.
- `variant-cli/package`: Node and Bun still print the same `--version` text, and that text includes the drawing only on a terminal.
- `variant-vscode/ipc-endpoint`: a `log` request is written to the Variant Worktrees channel. Lifecycle names stay refused.

## Impact

- New `packages/variant-log`, built before `variant-api`, `variant-ipc`, `variant-mcp`, and `variant-cli`.
- `packages/variant-api` call sites that pass a literal level, and messages that embed `[step]` or `[slug]`.
- `packages/variant-ipc` and `packages/variant-mcp` depend on `variant-log` and emit.
- `packages/variant-cli` log rendering, `variant --version`, and a lazy send of the log stream on the editor socket.
- `packages/variant-vscode` log-channel text, which reads `step` and `slug`, and a socket `log` request that writes that channel.
- Tests that match `warning:` or `debug:` on a library log line, a bracketed step inside the message, or the drawing on a piped `--version`. Config lines that print `warning:` stay.
- `README.md`, `docs/guide/core.md`, and `CHANGELOG.md`.

## Non-goals

- Config and migration lines that already print `warning:` and are not log events.
- Chat-renamer logs, timestamps, and printing the slug on the CLI.
- ANSI color in `variant-log`, MCP, or the editor channel.
- New log lines from `variant-server`.
- Changing which lifecycle events are emitted, the default threshold, or `-v` / `--verbose`.
- An ANSI italic style on the drawing. The cursive drawing is omitted when stdout is not a terminal.
