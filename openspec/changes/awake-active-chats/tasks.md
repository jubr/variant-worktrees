## 1. Focused composer ids

- [ ] 1.1 Add a failing spec beside a new reader under `packages/chat-renamer-vscode/src/cursor/` for [specs/chat-renamer/awake | One caffeinate process while a chat session is active](../../specs/chat-renamer/awake/spec.md#requirement-one-caffeinate-process-while-a-chat-session-is-active). Use a temporary workspace `state.vscdb` with `ItemTable` key `composer.composerData`. The reader returns `lastFocusedComposerIds` in order, capped at 20, and drops an id that is not `[A-Za-z0-9_-]+`. A 21st id is absent. A missing file, a missing key, and invalid JSON are an empty list and do not throw. Verify with `mise x -- bun test packages/chat-renamer-vscode/src/cursor/focused-composers.spec.ts`: the new assertions fail.

- [ ] 1.2 Implement that reader. Query `json_extract(value, '$.lastFocusedComposerIds')` with the existing read-only `sqlite3` runner. Resolve the workspace database as the `state.vscdb` beside `storageUri`, the same `dirname` pattern as the global database beside global storage. No `storageUri` is an empty list. Verify with the same `bun test` command: the file passes.

## 2. Activity sample

- [ ] 2.1 Add failing assertions for the same requirement. A temporary global `state.vscdb` holds `cursorDiskKV` rows. An aborted row with `unfinishedRunAt` set, whose id is among the first 20 focused ids and outside the first 20 pane-ordered selected ids, is active. A generating row whose id is not among those 20 is idle when no session file is fresh. When the composer signal is active, the session-file walk is not called. When every focused row is idle and a session file under an open workspace folder is fresh, the sample is active and the walk is called. A focus-list read that throws becomes an empty list, does not throw out of the sample, and the session-file walk still runs. The sample does not call `composer.getOrderedSelectedComposerIds`. Verify with `mise x -- bun test packages/chat-renamer-vscode/src/cursor/focused-composers.spec.ts packages/chat-renamer-vscode/src/cursor/composer-activity.spec.ts`: the new assertions fail.

- [ ] 2.2 Wire the default awake read in `packages/chat-renamer-vscode/src/trigger.ts` to that sample: focused ids, one point-read, skip the session-file walk only after an active row. Leave `orderedSelectedComposers` in place for peer titles and rename. Do not change `composerIsActive`. Verify with the same `bun test` command: both files pass.

## 3. Docs

- [ ] 3.1 Update `docs/chat-renamer/index.md`, `docs/chat-renamer/configuration.md`, `packages/chat-renamer-vscode/README.md`, the `chatRenamer.awake` comment in `packages/variant-config/variants.example.yaml`, and an Added bullet under `## Unreleased` in `CHANGELOG.md`, `packages/chat-renamer-vscode/CHANGELOG.md`, and `packages/variant-vscode/CHANGELOG.md`. State that the host examines the first 20 last-focused composers, that a selected chat outside that window does not count unless a session file under this workspace is fresh, and that an aborted row whose turn is still unfinished counts. Add `## Unreleased` above the newest version heading where it is missing. Verify each of those files says that, and that each changelog still has `## Unreleased`.

## 4. Validation

- [ ] 4.1 Run `mise x -- openspec validate --all --strict --no-interactive` and `mise x -- bun test packages/chat-renamer-vscode/src/cursor/focused-composers.spec.ts packages/chat-renamer-vscode/src/cursor/composer-activity.spec.ts packages/chat-renamer-vscode/src/trigger.spec.ts`. Verify both exit 0.
