## 1. Red: probe behavior

- [x] 1.1 Extend `packages/variant-vscode/mocks/vscode.ts` with `commands.getCommands`, `commands.executeCommand`, and `window.createOutputChannel` returning `clear`, `appendLine`, and `show`. Verify existing `extension.test.ts` still passes via `bun test packages/variant-vscode/src/extension.test.ts`.
- [x] 1.2 Add failing cases to `packages/variant-vscode/src/extension.test.ts` for command `variant-worktrees.probeCursorCommands`, palette title `Variant: Probe Cursor Chat Commands`, activation event `onCommand:variant-worktrees.probeCursorCommands`, `getCommands(true)`, channel name `Cursor Command Probe`, sorted hit lines, the empty-result line, a second run replacing the first, and no `executeCommand` call. Verify `bun test packages/variant-vscode/src/extension.test.ts` fails on the new cases while Hello World still passes.
- [x] 1.3 Add failing `packages/variant-vscode/src/cursor-command-probe.spec.ts` for the match table: include `composer.renameChat`, `Cursor.SetTitle`, `agent.updateLabel`, and `aichat.setTitle`; omit `cursor.openChat`, `workbench.action.rename`, and `variant-worktrees.helloworld`; drop duplicates; sort by UTF-16 code unit; empty input formats as `No rename-like commands found in this build.` Verify `bun test packages/variant-vscode/src/cursor-command-probe.spec.ts` fails because the module is absent.

## 2. Green: filter and command

- [x] 2.1 Implement `selectCursorTitleCommands` and the report formatter in `packages/variant-vscode/src/cursor-command-probe.ts` per design.md. Verify `bun test packages/variant-vscode/src/cursor-command-probe.spec.ts` passes.
- [x] 2.2 Register the probe from `activate`, contribute it in `packages/variant-vscode/package.json`, clear then show the channel, and never call `executeCommand`. Verify `bun test packages/variant-vscode/src/extension.test.ts` passes, including Hello World.
- [x] 2.3 Document in `packages/variant-vscode/README.md` that a listed id is not a stable rename API and the extension does not call it. Verify that limitation is present in the README.

## 3. Validation

- [x] 3.1 Run `task test`, `task lint`, and `task build` from the worktree root and verify each exits 0.
- [x] 3.2 Run `openspec validate --all --strict --no-interactive` and verify change `cursor-chat-win-rename` is valid.

## 4. Chat renamer extraction (experimental)

- [x] 4.1 Create `packages/chat-renamer-api` with request parsing, activation patterns, title numbering, first-prompt reader, hook installer, settings and rename core. Verify `bun test` in that package passes.
- [x] 4.2 Create `packages/chat-renamer-vscode` with `registerChatRenamer`, commands, triggers, logger and manifest. Verify `bun test` passes and `vsce package --no-dependencies` produces a vsix.
- [x] 4.3 Embed it in `packages/variant-vscode` with the `variant-worktrees` prefix and settings section, plus the manifest drift test. Verify `bun test` passes in `packages/variant-vscode`.

## 5. Single active instance

- [ ] 5.1 Red: add failing `claimRenamer` tests in `packages/chat-renamer-api` for first claim, second claimant idle, same id re-claim, release, and release by a non-owner. Verify they fail because the module is absent.
- [ ] 5.2 Green: implement `claimRenamer` over a `globalThis` registry. Verify the new tests pass.
- [ ] 5.3 Use the claim in `packages/chat-renamer-vscode` so a non-owner registers no listener, hook or URI handler and removes its own hook script. Verify with a test that two registrations produce one listener.

## 6. Realtime-only renaming

- [ ] 6.1 Red: add failing `handleCatalogTitleChange` cases for a prompt older than the start time, a prompt without a timestamp, an unreadable prompt, and a prompt inside the 30 second window. Verify they fail for the intended reason.
- [ ] 6.2 Green: add the `notBeforeMs` rule, require a timestamp, drop the title-text fallback, and default `maxAgeMs` to 30 seconds. Verify the cases pass.
- [ ] 6.3 Pass the renamer start time from `packages/chat-renamer-vscode`. Verify with a trigger-level test that events for older chats rename nothing.

## 7. Renamer validation

- [ ] 7.1 Run `task format:write`, `task check:full`, and `openspec validate --all --strict --no-interactive` and verify each exits 0.

