## Why

The chat renamer's log is a plain output channel of timestamped lines. It does not appear in the editor's **Developer: Show Logs…** list, it has no verbosity control, and for a new chat it never says why the title event renamed or did not rename. Diagnosing "why was my chat not renamed" means guessing which prompt text was read and which pattern was tried. The title event also scans every line of an arbitrarily long first prompt, although a rename request is always near the top.

## What Changes

- The log channels (`Chat Renamer`, `Variant Worktrees`) become log output channels, so they appear in the **Show Logs…** dropdown and obey the editor's per-channel log level (Trace, Debug, Info, Warning, Error). The channel is created during activation, which both manifests already trigger with `onStartupFinished`; the manifest tests pin that.
- The title-event trigger tests only the first 10 lines of a chat's first prompt against slash commands and activation patterns.
- Those first 10 lines are written to the log at the most verbose level (Trace) before matching.
- Every first title event of a chat logs one decision line: whether the prompt matched, which pattern matched, and the decision (`rename`, `keep`, `ignore`) with its reason.
- Logging becomes structured: a logger has levels (`trace`, `debug`, `info`, `warn`, `error`), named child categories rendered as `[category]`, and key/value fields rendered after the message. The title-event path uses it first; `[existing-chats]` lines keep their exact text by becoming a child category.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `chat-renamer-vscode/chat-renaming`: adds requirements for the log channel, the 10-line limit of the title event, the title-event decision log, and structured leveled log lines. Existing log line contracts (`[existing-chats]`, `rename <id>: <reason>; title ...`) stay as they are.

## Impact

- `packages/chat-renamer-api/src/log.ts` (leveled, categorised, field-carrying logger; line-sink adapter) and `cursor-chat-rename.ts` (10-line limit, trace prompt, decision lines).
- `packages/chat-renamer-api/src/chat-rename-patterns.ts` (report which pattern matched).
- `packages/chat-renamer-vscode/src/log.ts`, `trigger.ts`, `existing-chats.ts`, `commands.ts`, `register.ts`, and the test vscode mocks (`createOutputChannel(name, { log: true })`).
- `packages/chat-renamer-vscode/package.json` and `packages/variant-vscode/package.json` manifests are checked by tests, not given a new key (see design: the editor has no manifest contribution point for output channels).
- `packages/chat-renamer-vscode/README.md` and the changelogs.
- [specs/chat-renamer-vscode/chat-renaming](../../specs/chat-renamer-vscode/chat-renaming/spec.md).

## Non-goals

- Limiting the line count for the hook trigger, the existing-chats run, or the rename commands.
- Rewording existing log lines or changing the `rename <id>: <reason>; title ...` contract.
- A user setting for the line limit or log format; the editor's own log level selector controls verbosity.
- JSON-lines output or log files outside the editor's log channel.
