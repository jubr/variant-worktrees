## 1. Startup expand does not focus

- [x] 1.1 Add failing tests for [specs/variant-vscode/variants-tree | Variants view in the Explorer](../../specs/variant-vscode/variants-tree/spec.md#requirement-variants-view-in-the-explorer). In `packages/variant-vscode/src/variants-expand.spec.ts`, enabled expand reveals the Explorer root with `select: false` and `focus: false` and runs no command; disabled expand does not reveal. In `packages/variant-vscode/src/variants-view.spec.ts`, startup for `active` and `detected` reveals only `variant.variants` with those options, does not call `variant.variants.focus`, `variant.worktrees.focus`, or `workbench.action.focusActiveEditorGroup`, and `none` or `variant.autoExpand: false` does not reveal. Make `createTreeView` in `packages/variant-vscode/mocks/vscode.ts` return a `reveal` spy per view id. Verify `bun test packages/variant-vscode/src/variants-expand.spec.ts packages/variant-vscode/src/variants-view.spec.ts` fails first.

- [x] 1.2 Change `expandVariantsView` to take the Explorer tree and call `reveal(undefined, { select: false, focus: false })` only when expand is enabled. Pass the `variant.variants` tree from `registerVariantsView` after `createTreeView`. Verify the tests from 1.1 pass.

## 2. Detection focuses the section

- [x] 2.1 Add failing tests for [specs/variant-vscode/onboarding | Detection focuses the Explorer section](../../specs/variant-vscode/onboarding/spec.md#requirement-detection-focuses-the-explorer-section). In `packages/variant-vscode/src/onboarding-notice.spec.ts`, the path that shows the notification calls `focusSection` before `showInfo`; `active`, `none`, an already-shown workspace, and a non-showing check do not. **Bootstrap Variant** still runs `variant.onboardingInit` and does not add `variant.worktrees.focus`. In `packages/variant-vscode/src/onboarding.spec.ts`, `focusSection` runs `variant.variants.focus` when the dialog is closed and `variant.onboarding.focus` when it is open. Verify `bun test packages/variant-vscode/src/onboarding-notice.spec.ts packages/variant-vscode/src/onboarding.spec.ts` fails first.

- [x] 2.2 Add `focusSection` to the notice and call it only after the shown-record is written and before `showInfo`. Wire it from `registerOnboardingFlow`: `variant.onboarding.focus` when `onboarding.isOpen()`, otherwise `variant.variants.focus`. Do not change `variant.onboardingInit`. Verify the tests from 2.1 pass and `bun test packages/variant-vscode/src/onboarding-view.spec.ts` still passes.

## 3. Copy

- [x] 3.1 Update `variant.autoExpand` in `packages/variant-vscode/package.json`, `packages/variant-vscode/README.md`, and the root `README.md` so startup expands without taking focus, and detection focus is not described as a startup restore. Add an Unreleased **Changed** bullet to `packages/variant-vscode/CHANGELOG.md` and `CHANGELOG.md`. Verify those files no longer say startup returns focus to the editor.

## 4. Validation

- [x] 4.1 Run `bun test packages/variant-vscode`, `openspec validate --all --strict --no-interactive`, and `task check:changed`. Verify each passes.
