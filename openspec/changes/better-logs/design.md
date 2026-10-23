## Context

See proposal.md - Why. Today `chat-renamer-api/src/log.ts` has a `Logger` of `info`/`warn`/`error` that formats `<ISO time> <LEVEL> message` and calls `appendLine` on a plain `OutputChannel`. `chat-renamer-vscode/src/log.ts` creates that channel (`Chat Renamer`, or `Variant Worktrees` through `variant-vscode`). `catalogTitleOutcome` returns `renamed | same-base | ignored` with no reason, and `findRenameRequest` scans every line and does not say which pattern matched. Several log lines are specified verbatim (`[existing-chats]`, `rename <id>: <reason>; title ...`).

The reference logger (`vscode-previewur/src/logger.ts`) wraps a `vscode.LogOutputChannel`, adds a category path (`getChild`) rendered as `[a.b] message`, and exposes `trace`/`debug`/`info`/`warn`/`error`.

## Goals / Non-Goals

**Goals:**
- A channel the editor lists under **Show Logs…** and filters by level.
- A leveled, categorised logger with key/value fields, usable from `chat-renamer-api` without importing `vscode`.
- One decision line per new chat explaining the outcome, and the processed prompt at the most verbose level.

**Non-Goals:**
- Converting every existing log call to fields. Existing line texts are specified, so they stay.
- Persisting logs, or a setting for verbosity.
- A line limit for the hook script, which evaluates each line in Python and has its own contract.

## Decisions

**Log channel: `createOutputChannel(name, { log: true })`, no new manifest key.** The editor lists a channel under **Show Logs…** because it is a log output channel, which only the `{ log: true }` option creates. The VS Code extension manifest has no contribution point that announces an output channel (the Cursor 3.26.13 workbench registers no `outputChannels` contribution point; channels are registered when `createOutputChannel` runs). So "announce it in `package.json`" is met by what the manifest can do: both manifests keep `activationEvents` `onStartupFinished`, which runs `activate` right after startup, so the channel is listed without a command run. A manifest test pins that and the channel names. Alternative: add a made-up `contributes.outputChannels` key. Rejected: the editor ignores unknown keys and `vsce` may warn about them.

**Logger shape in `chat-renamer-api`.**
`Logger` gains `trace`, `debug`, `child(category)`, and an optional trailing `fields` argument: `info(message, fields?)`, `error(message, cause?, fields?)`. `createLogger(sink)` takes a `LogSink` of `trace/debug/info/warn/error(message: string)`, which `vscode.LogOutputChannel` satisfies structurally, so the API package keeps no `vscode` dependency. It renders `[category] message key=value ...` and adds no timestamp or level, since the channel does. `lineSink(appendLine, now)` adapts the old `appendLine` shape (`<ISO time> LEVEL message`) for tests and embedders that pass a plain channel. `silentLogger` implements the new shape with `child` returning itself. Alternative: make the API package depend on `vscode` types and copy `logger.ts`. Rejected: the API package is editor independent and unit-tests without a host.

**Field rendering.** Strings, objects and arrays use `JSON.stringify`; numbers, booleans and `null` plain; `undefined` fields are dropped. Keys are written in call order. This keeps a line greppable (`rg 'decision="ignore"'`) and one line per event. Alternative: pass fields as extra channel arguments as `logger.ts` does. Rejected: the channel renders objects on extra lines and the field order is not under our control.

**"Verbose" is `trace`.** The editor's levels run Trace, Debug, Info, Warning, Error; Trace is the most verbose and is the level that holds the prompt text, since a prompt can hold private text and should show only when someone asks for it. Alternative: `debug`. Rejected: users switch to Debug for ordinary diagnosis and would then print prompts.

**Line limit as a setting and a pure helper.** `titleEventPromptLines` joins the shared option set in `chat-renamer-config` (default constant `DEFAULT_TITLE_EVENT_PROMPT_LINES = 10`, rule `isPromptLineLimit` = integer >= 1, Zod schema in `./schema`, key in `ChatRenamerConfigSchema`), so `variants.yaml` accepts it for free and `variants.yaml.schema.json` is regenerated. `readTriggerSettings` normalises it (invalid falls back to 10) and `readSettings` layers editor > host > default as for every option. Both manifests contribute `titleEventPromptLines` (type `integer`, `minimum` 1, default 10); the existing manifest-copy test keeps them in step. `trigger.ts` reads it on every apply, and `apply` already reruns on configuration changes, so it applies without a reload. `firstLines(text, limit)` returns `{ text, lines, dropped }` by splitting on `\r?\n`. `TitleChangeOptions` gets `maxLines`; unset means the whole prompt, which is what `renameActiveChat` passes. `catalogTitleOutcome` logs the kept lines at `trace` (category `title-event`, fields `session`, `lines`, `dropped`), then matches only those lines. `findRenameRequest` is unchanged for other callers; it gains an optional result field `patternIndex` (set when an activation pattern produced the title, absent for slash commands) so the decision can name the pattern. The limit lives in the title-event function only, so hook, existing-chats and commands keep scanning the whole prompt.

**Decision as a data result.** `catalogTitleOutcome` returns `{ outcome, decision, reason, matched, patternIndex?, title?, detail? }` (`detail` holds the parse reason of a malformed request); `handleCatalogTitleChange` keeps returning a boolean. The single decision log call sits at the end of `catalogTitleOutcome`, after the rename call has resolved, so the entry reports what happened. Early exits (`no first prompt`, `before startup`, `too old`) log at `debug`. A rejection inside the rename call is caught in `trigger.ts`, which logs the `title event failed` decision at `error` level and shows the warning `Chat rename failed for <id>: <message>`. The trigger's existing `title event <id> ...` info line is replaced by the decision entry so one chat does not produce two.

**Categories.** `registerChatRenamer` hands a root logger down; modules take `log.child("title-event")` and `log.child("existing-chats")`. `[existing-chats]` stays byte-identical because the child renders it as `[existing-chats] message`, so the `EXISTING_CHATS_TAG` string prefix is dropped from messages. The unchanged `rename <id>: ...` lines are logged on the root logger (no category).

**Failure notifications carry the why.** The decision result already holds `reason` and `detail`, so `renameActiveChat` builds its warning from them (`This chat was not renamed: no rename request`, `... malformed request: <detail>`) instead of the fixed `This chat has no rename request.`. A throw inside the command is caught, shown as `Chat rename failed: <message>`, and rethrown so the command still fails for callers. The title-event trigger shows its own warning on a throw and stays silent for ordinary `ignore` decisions, so a normal prompt never pops a notification.

**Test mocks.** `createOutputChannel` in both vscode mocks accepts an options argument and returns a channel with the five level methods, so `createExtensionLog` is testable for `{ log: true }` and channel names.

## Risks / Trade-offs

- [Prompt text in the log] → Only at `trace`, only 10 lines, never anything beyond line 10.
- [The log level a user picked is not changed by us] → The default level of a log channel is Info, so the new `trace` entries stay hidden until the user selects Trace in the channel's level picker; the README says so.
- [A rename failing for every new chat repeats a notification] → Only throws notify, never ordinary non-matches; the log has the same cause for detail.
- [Decision line per chat at startup is noisy] → Only evaluated chats log at `info`; startup replays log at `debug`.
- [Field values leak into messages tests compare] → Existing message texts are asserted unchanged in tests before refactoring.
- [Standalone and embedded instances both exist] → Only the owner logs decisions; the idle instance logs its one idle line as today.

## Open Questions

- `package.json` has no output-channel key in this editor version. If a newer editor adds one, adopt it then; nothing in this design blocks that.
