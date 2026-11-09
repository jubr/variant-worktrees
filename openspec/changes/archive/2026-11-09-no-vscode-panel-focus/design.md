## Context

See proposal.md for motivation. Startup expand lives in `variants-expand.ts`. It runs `variant.variants.focus`, then `workbench.action.focusActiveEditorGroup`. `registerVariantsView` calls that when `getVariantsAdoption` is `active` or `detected` and `variant.autoExpand` is not `false`. The same function creates two trees from one provider: `variant.variants` in the Explorer and `variant.worktrees` on the activity bar. The manifest starts the Explorer view `collapsed`. `createOnboardingNotice` shows the one-time notification and, on **Bootstrap Variant**, runs `variant.onboardingInit`. That command already focuses `variant.onboarding`. The extension tests use `mocks/vscode.ts`. Its `createTreeView` returns a disposable with no `reveal`.

## Goals / Non-Goals

**Goals:**

- Expand the Explorer tree through the tree handle, with focus and selection left off.
- Focus that same Explorer section from the notice only on the path that shows the notification.
- Leave the onboarding command's focus path as it is.

**Non-Goals:**

- A real editor host in the test runner. Assertions stay on the mock.
- A new command id for "expand without focus".

## Decisions

**Startup expand calls `TreeView.reveal`, not the focus command.** `expandVariantsView` receives the Explorer tree (`variant.variants`) and, when expand is enabled, calls `reveal(undefined, { select: false, focus: false })`. `undefined` is the root, so the call opens the view without an item. Disabled expand returns without calling `reveal`. It never runs `variant.variants.focus`, `variant.worktrees.focus`, or `workbench.action.focusActiveEditorGroup`. `registerVariantsView` already creates the Explorer tree before it expands, and it passes only that tree. Alternative: keep focus-then-restore. Rejected — the focus command takes the section after the restore, which is the bug. Alternative: set the manifest visibility to `visible`. Rejected — the contribution would start expanded for `none` and for `variant.autoExpand: false`. Alternative: a private workbench command. Rejected — `reveal` is the supported API and `createTreeView` already returns it.

**The notice focuses with `variant.variants.focus` only when it shows the notification.** After the shown-record is written and before `showInfo`, the notice runs that command. Early returns (already shown, `active`, `none`) do not. The notice does not read `variant.autoExpand`, so `false` does not block this focus. It does not run `variant.worktrees.focus`. The **Bootstrap Variant** handler still runs `variant.onboardingInit` and does not grow a second focus of its own. Alternative: `reveal` with `focus: true` from the tree handle. Rejected — the notice already has `runCommand`, and the focus command is the same one the dialog uses. The notice stays free of a tree handle.

**The onboarding command is unchanged.** `variant.onboardingInit` still focuses `variant.onboarding` and grows the section. Closing the dialog still focuses `variant.variants`. That close path is not startup. When the dialog is already open, `variant.variants` is hidden (`when` includes `!variant.onboardingOpen`), so a detection focus of that id would miss the visible section. The flow passes `focusSection`: if `onboarding.isOpen()`, run `variant.onboarding.focus`; otherwise run `variant.variants.focus`. The command's own `open` is not rewritten.

**The mock records `reveal`.** `createTreeView` returns `reveal(element, options)` per view id. Startup tests assert the Explorer tree was revealed with `select: false` and `focus: false`, and that neither tree was focused and `workbench.action.focusActiveEditorGroup` did not run. Notice tests assert `variant.variants.focus` only on the path that shows the notification.

## Risks / Trade-offs

- [A host still activates the sidebar when a collapsed view is revealed with `focus: false`] → The unit test pins `focus: false`, `select: false`, and the absence of both focus commands. Do not add a compensating `focusActiveEditorGroup`. That call moves focus.
- [Reveal of `variant.worktrees` selects the activity bar] → Only the Explorer tree is passed into expand. The notice command id is `variant.variants.focus`.
- [Reveal runs before the tree exists] → Expand stays after `createTreeView(variant.variants)`.
- [The dialog is open when a commit is detected] → `focusSection` focuses `variant.onboarding` in that case, so the hidden tree is not the target.

## Migration Plan

No setting rename and no workspace-state key change. `variant.autoExpand` keeps its meaning for startup expand. The same change updates the setting text, both READMEs, and `CHANGELOG.md` so they stop saying startup returns focus to the editor. Rollback is reverting the commit. Nothing persisted has to be rewritten.
