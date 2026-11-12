## 1. High-volume categories

- [ ] 1.1 Add a failing spec in `packages/variant-log` for [specs/variant-log/events | High-volume categories are opt-in](../../specs/variant-log/events/spec.md#requirement-high-volume-categories-are-opt-in). Registering an id lists it once, in order. Registering it again does not duplicate it. Verify with `mise x -- bun test packages/variant-log`: the new assertions fail.

- [ ] 1.2 Implement `registerHighVolumeCategory` and `listHighVolumeCategories` in `packages/variant-log/src/index.ts`. Verify with the same `bun test` command: the file passes.

- [ ] 1.3 From `packages/chat-renamer-api/src/awake.ts`, register `awake.agentHostEvents` when that module loads. Add a `variant-log` dependency and keep it external in the package build, as `chat-renamer-config` is. Verify with `mise x -- bun test packages/chat-renamer-api/src/awake.spec.ts packages/variant-log`: loading the awake module lists `awake.agentHostEvents`, and the file passes.

## 2. Detection method and the focused poll

- [ ] 2.1 Extend `packages/chat-renamer-api/src/awake.spec.ts` with failing assertions for [specs/chat-renamer/awake | Awake activity is logged](../../specs/chat-renamer/awake/spec.md#requirement-awake-activity-is-logged). When the controller is told the watcher exists, the one info line is `[awake] caffeinate available method="agentHost+poll"`. When it is told the watcher does not exist, the line is `[awake] caffeinate available method="poll"`. The unavailable line stays `[awake] caffeinate unavailable` with no method. A later active session does not add a second binary line. Verify with `mise x -- bun test packages/chat-renamer-api/src/awake.spec.ts`: the new assertions fail.

- [ ] 2.2 Pass the detection method into the controller and put it on that info line. Verify with the same `bun test` command: the file passes.

- [ ] 2.3 Add a failing spec beside a new reader under `packages/chat-renamer-vscode/src/cursor/` for [specs/chat-renamer/awake | One caffeinate process while a chat session is active](../../specs/chat-renamer/awake/spec.md#requirement-one-caffeinate-process-while-a-chat-session-is-active). A temporary workspace `state.vscdb` `ItemTable` key `composer.composerData` yields `lastFocusedComposerIds` in order, capped at 20. A 21st id and an unsafe id are absent. A missing file, a missing key, and invalid JSON are an empty list and do not throw. An aborted global `cursorDiskKV` row with `unfinishedRunAt` set, whose id is in that list and outside the first 20 pane-ordered ids, is active. A generating row outside the list is idle. Verify with `mise x -- bun test packages/chat-renamer-vscode/src/cursor/focused-composers.spec.ts`: the new assertions fail.

- [ ] 2.4 Implement that reader with the existing read-only `sqlite3` runner and the database beside `storageUri`. Verify with the same `bun test` command: the file passes.

## 3. Watcher, poll, and the checkbox

- [ ] 3.1 Add a failing spec for the turn watcher and [specs/chat-renamer/awake | Turn watcher events are traced](../../specs/chat-renamer/awake/spec.md#requirement-turn-watcher-events-are-traced). A fake watcher reports start and end. With `awake.agentHostEvents` enabled, start and end each write one trace line `[awake]` with the session id, the turn id, and the phase, and not at info. With the category omitted, those events write nothing at any level. A start makes the sample active before the poll. An end while the poll is still active leaves the sample active. Dispose clears the watcher set. A failed create stays on the poll. Verify with `mise x -- bun test packages/chat-renamer-vscode/src/cursor/turn-watcher.spec.ts`: the new assertions fail.

- [ ] 3.2 Implement the watcher adapter. Borrow `anysphere.cursor-retrieval` only for the synchronous create call. Gate the event traces on the enabled category set. Verify with the same `bun test` command: the file passes.

- [ ] 3.3 Extend `packages/chat-renamer-vscode/src/trigger.spec.ts` with failing assertions for the caffeinate requirement. The owning instance with `awake.when` `chatsActive` creates one watcher and schedules the focused read every 5 seconds, not every second. A start event spawns `caffeinate` with the existing argv. An end while the poll is idle starts the grace delay. `awake.when` `never` and dispose stop the timer and the watcher. The sample does not call `composer.getOrderedSelectedComposerIds` and does not walk session files. Verify with `mise x -- bun test packages/chat-renamer-vscode/src/trigger.spec.ts`: the new assertions fail.

- [ ] 3.4 Wire `startChatRenameTrigger` to the watcher and the 5-second focused poll. Remove the pane-order read and the session-file walk from the awake path. Leave `orderedSelectedComposers` for peer titles and rename. Verify with the same `bun test` command: the file passes.

- [ ] 3.5 Add `variant.log.highVolumeCategories` and `chat-renamer.log.highVolumeCategories` to the two manifests as an array of enum strings, default `[]`, so the settings UI shows a checkbox per entry. The only entry is `awake.agentHostEvents`. A test loads the awake module and fails if either enum differs from `listHighVolumeCategories()`. Changing the setting applies without a reload. Verify with `mise x -- bun test packages/variant-vscode/src/test/variants-manifest.spec.ts packages/chat-renamer-vscode`: the new assertion fails, then passes after the manifests match.

## 4. Docs

- [ ] 4.1 Update `docs/chat-renamer/index.md`, `docs/chat-renamer/configuration.md`, `packages/chat-renamer-vscode/README.md`, the `chatRenamer.awake` comment in `packages/variant-config/variants.example.yaml`, and an Added bullet under `## Unreleased` in `CHANGELOG.md`, `packages/chat-renamer-vscode/CHANGELOG.md`, and `packages/variant-vscode/CHANGELOG.md`. State that awake follows this window's turn events and also polls the first 20 last-focused composers every 5 seconds, that the startup line names `agentHost+poll` or `poll`, and that `variant.log.highVolumeCategories` is an opt-in checkbox list whose first entry is `awake.agentHostEvents`. Add `## Unreleased` above the newest version heading where it is missing. Verify each of those files says that, and that each changelog still has `## Unreleased`.

## 5. Validation

- [ ] 5.1 Run `mise x -- openspec validate --all --strict --no-interactive` and `mise x -- bun test packages/variant-log packages/chat-renamer-api/src/awake.spec.ts packages/chat-renamer-vscode/src/cursor/focused-composers.spec.ts packages/chat-renamer-vscode/src/cursor/turn-watcher.spec.ts packages/chat-renamer-vscode/src/trigger.spec.ts`. Verify both exit 0.
