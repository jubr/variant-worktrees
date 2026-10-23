## 1. Leveled, structured logger

- [ ] 1.1 Extend `packages/chat-renamer-api/src/log.spec.ts` with failing tests for [specs/chat-renamer-vscode/chat-renaming | Log lines are leveled and structured](../../specs/chat-renamer-vscode/chat-renaming/spec.md#requirement-log-lines-are-leveled-and-structured): a sink receives `trace`/`debug`/`info`/`warn`/`error` entries with the right level; `child("title-event")` prefixes `[title-event] `; nested children join with `.`; fields render as `key=value` in call order with JSON for strings, objects and arrays; `undefined` fields are dropped; no timestamp or level text is added; `error(message, cause)` keeps `message: cause`; `silentLogger.child()` never throws; `lineSink` keeps the old `<ISO time> LEVEL message` lines. Verify `bun test packages/chat-renamer-api/src/log.spec.ts` fails first.
- [ ] 1.2 Implement `Logger`, `LogSink`, `createLogger(sink)`, `lineSink(appendLine, now)` and `silentLogger` in `packages/chat-renamer-api/src/log.ts` and export them from the package index. Update existing callers of `createLogger` to pass `lineSink(...)`. Verify `bun test packages/chat-renamer-api` passes.

## 2. Log channel

- [ ] 2.1 Add failing tests in `packages/chat-renamer-vscode/src/log.test.ts` (new) and `packages/variant-vscode/src/extension.test.ts` for [specs/chat-renamer-vscode/chat-renaming | The log channel is a log output channel](../../specs/chat-renamer-vscode/chat-renaming/spec.md#requirement-the-log-channel-is-a-log-output-channel): the standalone extension calls `createOutputChannel("Chat Renamer", { log: true })`, Variant calls it with `"Variant Worktrees"` and creates no `Chat Renamer` channel, and entries reach the channel's level methods. Extend both manifest tests to assert `activationEvents` contains `onStartupFinished`. Update the `createOutputChannel` mocks in `packages/chat-renamer-vscode/test/vscode-mock.ts` and `packages/variant-vscode/mocks/vscode.ts` to take options and return the five level methods. Verify the new tests fail first.
- [ ] 2.2 Make `createExtensionLog` create the channel with `{ log: true }` and wrap it with `createLogger`. Verify the new tests and `bun test packages/chat-renamer-vscode packages/variant-vscode` pass.

## 3. Ten-line limit and prompt trace

- [ ] 3.1 Add failing tests in `packages/chat-renamer-api/src/cursor-chat-rename.spec.ts` for [specs/chat-renamer-vscode/chat-renaming | The title event reads only the first 10 prompt lines](../../specs/chat-renamer-vscode/chat-renaming/spec.md#requirement-the-title-event-reads-only-the-first-10-prompt-lines): a request on line 10 renames, a request on line 11 does not, `\r\n` prompts count lines the same way, lines 1 to 10 are logged at `trace` with `session`, `lines` and `dropped`, no other level holds prompt text, and `renameChatFromPrompt` still matches on line 11. Verify they fail first.
- [ ] 3.2 Add a `firstLines(text, limit)` helper and use it in `catalogTitleOutcome` before matching. Verify the new tests and `bun test packages/chat-renamer-api` pass.

## 4. Decision log

- [ ] 4.1 Add failing tests in `packages/chat-renamer-api/src/chat-rename-patterns.spec.ts` that `findRenameRequest` reports `patternIndex` for an activation pattern match and none for a slash command. In `cursor-chat-rename.spec.ts` and `packages/chat-renamer-vscode/src/trigger.test.ts` add failing tests for every scenario of [specs/chat-renamer-vscode/chat-renaming | The title event decision is logged](../../specs/chat-renamer-vscode/chat-renaming/spec.md#requirement-the-title-event-decision-is-logged): pattern renamed (`pattern=2`), slash renamed, no match, malformed, `keep`, `before startup` at `debug` with no `info` entry, `too old`, `no first prompt`, a failing rename at `error`, and no entry for a later title event. Verify they fail first.
- [ ] 4.2 Return `patternIndex` from `findRenameRequest`. Make `catalogTitleOutcome` return `{ outcome, decision, reason, matched, patternIndex?, title? }`, keep `handleCatalogTitleChange` returning a boolean, and log the decision in category `title-event` at the levels the spec names. Replace the `title event <id> ...` line in `trigger.ts` with the `title event failed` decision at `error`. Verify the new tests pass and the existing `rename <id>: <reason>; title ...` assertions are unchanged.

## 5. Categories for existing lines

- [ ] 5.1 Tests in `trigger.test.ts` and `existing-chats` tests already assert `[existing-chats]` lines; run them as the failing-first check after changing `existing-chats.ts` and `trigger.ts` to log through `log.child("existing-chats")` and drop the string prefix. If a test must be adjusted, assert the same final text. Verify `bun test packages/chat-renamer-vscode` passes and the rendered lines are byte-identical to before.

## 6. Docs and validation

- [ ] 6.1 Update `packages/chat-renamer-vscode/README.md` (channel is listed under Show Logs…, how to select Trace to see the prompt and the decision line fields, the 10-line limit) and add Unreleased entries to `packages/chat-renamer-vscode/CHANGELOG.md`, `packages/variant-vscode/CHANGELOG.md` and the root `CHANGELOG.md` if the repo's changelog policy asks for it. Verify `task docs:build` passes if docs changed.
- [ ] 6.2 Run `task lint`, `task test`, `task build`, `openspec validate --all --strict --no-interactive`, and `task check:full`. Verify each passes.
