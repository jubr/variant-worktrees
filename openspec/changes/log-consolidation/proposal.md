## Why

CLI log lines are `level: message` with no color, so a step buried in the message (`[create] + mise install`) looks the same as the sentence after it. `variant --version` always prints the cursive drawing, including when stdout is a pipe and the drawing is only noise.

## What Changes

- **BREAKING** A library log line on the CLI is `[level] step message` when the message starts with `[step]`, and `[level] message` when it does not. The displayed level words stay `trace`, `debug`, `info`, `warning`, and `error` (`warn` still prints as `warning`). The old prefixes `trace:`, `debug:`, `info:`, `warning:`, and `error:` are gone for these lines. The slug field is still not printed.
- When standard error is a terminal and `NO_COLOR` is unset, the brackets are dark gray, the level word has its own color, the step is cyan, and the message is the default terminal color. Otherwise the same characters are printed with no ANSI sequences.
- **BREAKING** `variant --version` prints the cursive drawing only when standard output is a terminal. A pipe or a redirect omits the drawing and the blank line that followed it. The version line and the details line stay. On a terminal, orange coloring is unchanged: color when `NO_COLOR` is unset, plain glyphs when it is set.
- The library gains `logT`, `logD`, `logI`, `logW`, and `logE`. Each emits the same event as `log` at one fixed level. `log` stays for a level chosen by the caller. Call sites that pass a literal level use the matching shorthand.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `variant-cli/logging`: log lines use `[level]`, an optional leading step, and the colors above. Threshold, stderr, and `-v` stay.
- `variant-api/commands`: the cursive `--version` drawing is printed only when standard output is a terminal.
- `variant-cli/package`: Node and Bun still print the same `--version` text, and that text includes the drawing only on a terminal.
- `variant-api/logging`: `logT`, `logD`, `logI`, `logW`, and `logE` emit trace, debug, info, warn, and error.

## Impact

- `packages/variant-cli` log rendering and `variant --version`.
- `packages/variant-api` log helpers and the call sites that pass a literal level (`log`, `emit`, `logEvent`).
- Tests that match `warning:`, `trace:`, `debug:`, or the drawing on a piped `--version`.
- `README.md`, `docs/guide/core.md`, and `CHANGELOG.md`, which describe the prefixes and the banner.

## Non-goals

- Config and migration lines that already print `warning:` and are not library log events.
- The editor's log-channel text, chat-renamer logs, timestamps, and printing the slug on the CLI.
- Changing which events are emitted, the default threshold, or `-v` / `--verbose`.
- Rewriting message text. A leading `[step]` is only how the CLI chooses the cyan word. A second bracket stays in the message.
- An ANSI italic style on the drawing. "Italic" here is the existing cursive drawing, omitted when stdout is not a terminal.
