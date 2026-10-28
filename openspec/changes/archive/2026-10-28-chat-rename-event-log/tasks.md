## 1. Log every title event

- [x] 1.1 Add a failing test in `packages/chat-renamer-vscode/src/trigger.test.ts` for [specs/chat-renamer/chat-renaming | Every title event is logged on arrival](../../specs/chat-renamer/chat-renaming/spec.md#requirement-every-title-event-is-logged-on-arrival): a first event, a later event of the same chat and an event without a title each write a `debug` entry `[title-event] event session=… title=…`. Verify it fails first.
- [x] 1.2 Log the event at `debug` in category `title-event` at the top of the title event listener in `packages/chat-renamer-vscode/src/trigger.ts`, before the `checked` guard. Verify `bun test packages/chat-renamer-vscode` passes.

## 2. Verify

- [x] 2.1 Run `task lint`, `task build`, `task test` and `openspec validate --all --strict --no-interactive`.
