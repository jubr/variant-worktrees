## 1. Red: probe behavior

- [x] 1.1 Extend `packages/variant-vscode/mocks/vscode.ts` with `commands.getCommands`, `commands.executeCommand`, and `window.createOutputChannel` returning `clear`, `appendLine`, and `show`. Verify existing `extension.test.ts` still passes via `bun test packages/variant-vscode/src/extension.test.ts`.
- [x] 1.2 Add failing cases to `packages/variant-vscode/src/extension.test.ts` for command `variant-vscode.probeCursorCommands`, palette title `Variant: Probe Cursor Chat Commands`, activation event `onCommand:variant-vscode.probeCursorCommands`, `getCommands(true)`, channel name `Cursor Command Probe`, sorted hit lines, the empty-result line, a second run replacing the first, and no `executeCommand` call. Verify `bun test packages/variant-vscode/src/extension.test.ts` fails on the new cases while Hello World still passes.
- [x] 1.3 Add failing `packages/variant-vscode/src/cursor-command-probe.spec.ts` for the match table: include `composer.renameChat`, `Cursor.SetTitle`, `agent.updateLabel`, and `aichat.setTitle`; omit `cursor.openChat`, `workbench.action.rename`, and `variant-vscode.helloworld`; drop duplicates; sort by UTF-16 code unit; empty input formats as `No rename-like commands found in this build.` Verify `bun test packages/variant-vscode/src/cursor-command-probe.spec.ts` fails because the module is absent.

## 2. Green: filter and command

- [x] 2.1 Implement `selectCursorTitleCommands` and the report formatter in `packages/variant-vscode/src/cursor-command-probe.ts` per design.md. Verify `bun test packages/variant-vscode/src/cursor-command-probe.spec.ts` passes.
- [x] 2.2 Register the probe from `activate`, contribute it in `packages/variant-vscode/package.json`, clear then show the channel, and never call `executeCommand`. Verify `bun test packages/variant-vscode/src/extension.test.ts` passes, including Hello World.
- [x] 2.3 Document in `packages/variant-vscode/README.md` that a listed id is not a stable rename API and the extension does not call it. Verify that limitation is present in the README.

## 3. Validation

- [x] 3.1 Run `task test`, `task lint`, and `task build` from the worktree root and verify each exits 0.
- [x] 3.2 Run `openspec validate --all --strict --no-interactive` and verify change `cursor-chat-win-rename` is valid.
