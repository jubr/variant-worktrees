## Why

The chat renamer's log is a plain output channel of timestamped lines. It does not appear in the editor's **Developer: Show Logs…** list, it has no verbosity control, and for a new chat it never says why the title event renamed or did not rename. Diagnosing "why was my chat not renamed" means guessing which prompt text was read and which pattern was tried. The title event also scans every line of an arbitrarily long first prompt, although a rename request is always near the top.

## What Changes

- The log channels (`Chat Renamer`, `Variant Worktrees`) become log output channels, so they appear in the **Show Logs…** dropdown and obey the editor's per-channel log level (Trace, Debug, Info, Warning, Error). The channel is created during activation, which both manifests already trigger with `onStartupFinished`; the manifest tests pin that.
- The title-event trigger tests only the first N lines of a chat's first prompt against slash commands and activation patterns. N is a new setting `titleEventPromptLines` (default 10, minimum 1) in both extension manifests and in the `chatRenamer` section of `variants.yaml`.
- Those lines are written to the log at the most verbose level (Trace) before matching.
- A failed rename tells the user why: the title-event failure notification and the `renameActiveChat` notifications carry the reason text.
- Every first title event of a chat logs one decision line: whether the prompt matched, which pattern matched, and the decision (`rename`, `keep`, `ignore`) with its reason.
- Logging becomes structured: a logger has levels (`trace`, `debug`, `info`, `warn`, `error`), named child categories rendered as `[category]`, and key/value fields rendered after the message. The title-event path uses it first; `[existing-chats]` lines keep their exact text by becoming a child category.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `chat-renamer/chat-renaming`: adds requirements for the log channel, the configurable line limit of the title event, the title-event decision log, structured leveled log lines, and failure notifications with a reason; modifies the settings list and the active-chat command. Existing log line contracts (`[existing-chats]`, `rename <id>: <reason>; title ...`) stay as they are.
- `chat-renamer-config/defaults`: the shared option set gains `titleEventPromptLines` (default 10).
- `variant-config/core`: the `chatRenamer` section accepts `titleEventPromptLines`.

## Impact

- `packages/chat-renamer-api/src/log.ts` (leveled, categorised, field-carrying logger; line-sink adapter) and `cursor-chat-rename.ts` (10-line limit, trace prompt, decision lines).
- `packages/chat-renamer-api/src/chat-rename-patterns.ts` (report which pattern matched).
- `packages/chat-renamer-vscode/src/log.ts`, `trigger.ts`, `existing-chats.ts`, `commands.ts`, `register.ts`, and the test vscode mocks (`createOutputChannel(name, { log: true })`).
- `packages/chat-renamer-config` (default, rule, schema), `packages/chat-renamer-api/src/chat-rename-settings.ts`, `packages/chat-renamer-vscode/src/settings.ts`.
- `packages/chat-renamer-vscode/package.json` and `packages/variant-vscode/package.json`: new setting `titleEventPromptLines`; no output-channel key (see design: the editor has no manifest contribution point for output channels).
- `packages/variant-config` (`variants.yaml.schema.json`, `variants.example.yaml`) and `docs/chat-renamer/`.
- `packages/chat-renamer-vscode/src/commands.ts` and `trigger.ts` (notifications with reasons).
- Packaging: both `.vsix` files are built into `out/` as the last task.
- `packages/chat-renamer-vscode/README.md` and the changelogs.
- [specs/chat-renamer/chat-renaming](../../specs/chat-renamer/chat-renaming/spec.md).

## Non-goals

- Limiting the line count for the hook trigger, the existing-chats run, or the rename commands (the setting applies to the title event only).
- Rewording existing log lines or changing the `rename <id>: <reason>; title ...` contract.
- A setting for log format or log level; the editor's own log level selector controls verbosity.
- JSON-lines output or log files outside the editor's log channel.
