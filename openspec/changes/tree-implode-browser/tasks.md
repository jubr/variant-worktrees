## 1. Force from the muted explosion

- [ ] 1.1 Replace the muted-explosion test in `packages/variant-vscode/src/variants-view.spec.ts` with failing tests for [specs/variant-vscode/variants-tree | Inline actions](../../specs/variant-vscode/variants-tree/spec.md#requirement-inline-actions): activating `variant.implodeDirty` shows a non-modal warning ``Clean implode failed, do you want to `--force`?`` with buttons `Cancel` and `Force` and does not call implode; `Cancel` and a dismissal leave the variant and log `implode cancelled`; `Force` calls implode with `force: true` and does not show the clean modal. A clean implode still uses the modal. Verify `bun test packages/variant-vscode/src/variants-view.spec.ts` fails on these tests.
- [ ] 1.2 Handle `variant.implodeDirty` with `showWarningMessage` (no `modal` option). Pass `{ force: true, log }` from `actions.implode` only when Force was chosen. Verify `bun test packages/variant-vscode/src/variants-view.spec.ts` passes.

## 2. Open url left of the run control

- [ ] 2.1 Add failing tests in `packages/variant-vscode/src/variants-view.spec.ts` for the same requirement: an inline command at `inline@0` when the row context contains `has-url`, absent without it, icon `$(link-external)`, title `Open url in external browser`, `alt` command title `Open url in Cursor browser`. Activating the primary command calls `openExternal` with the row URL and does not call `simpleBrowser.api.open`. Activating the alt command calls `simpleBrowser.api.open` with that URI and does not call `openExternal`. The context-menu command stays `Variant: Open URL`. The header command `variant.openInBrowser` is unchanged. Verify `bun test packages/variant-vscode/src/variants-view.spec.ts` fails on these tests.
- [ ] 2.2 Contribute the two commands and the `inline@0` menu item with `alt`. Wire the handlers. Verify `bun test packages/variant-vscode/src/variants-view.spec.ts` passes.

## 3. Failure notifications

- [ ] 3.1 Add tests in `packages/variant-vscode/src/variants-view.spec.ts` for the same requirement: a failing watch, a failing down, and a failing forced implode each show a non-modal error notification whose text is the error message, and the log records the failure. `showErrorMessage` is already non-modal. Verify `bun test packages/variant-vscode/src/variants-view.spec.ts` passes. If a case does not notify, fix that case only.

## 4. Docs and validation

- [ ] 4.1 Update `packages/variant-vscode/README.md`, `docs/guide/core.md`, `CHANGELOG.md`, and `packages/variant-vscode/CHANGELOG.md` so the muted explosion offers force, the row has Open url, and a failed watch, down, or implode shows the error. Verify `task docs:build` passes.
- [ ] 4.2 Run `task lint`, `task test`, `task build`, and `openspec validate --all --strict --no-interactive`. Verify each passes.
