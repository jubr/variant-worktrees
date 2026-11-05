## Context

See proposal.md for why. Today `contributes.views.explorer` holds `variant.variants` (the native tree) and `variant.onboarding` (the webview that replaces that section while onboarding is open). `registerVariantsView` builds one `VariantsTreeProvider` and one store, then calls `createTreeView("variant.variants", { treeDataProvider })`. Title and item menus are gated with `view == variant.variants`. Welcome content is keyed to that view id. Startup expand runs `variant.variants.focus` and then returns focus to the editor. **Variant: Open Variants Panel** is a separate webview (`variants-panel.ts`), not a view container.

A contributed view id belongs to one container. The host requires an icon on a `viewsContainers.panel` entry. In a `when` clause, `&&` binds tighter than `||`.

## Goals / Non-Goals

**Goals:**

- Add the panel container and a second view id with contribution JSON and one extra `createTreeView` on the provider that already exists.
- Keep commands, the store, and the tree provider singular.

**Non-Goals:**

- Generating `package.json` menus, a new icon asset, or a second provider.
- Focusing `variant.worktrees` from startup expand or from onboarding.

## Decisions

### Second view id in a panel container

`viewsContainers.panel` gets id `variantWorktrees`, title `Variant Worktrees`, icon `media/icon-128.png` (the existing 128px product mark; no new asset). `views.variantWorktrees` gets one view, id `variant.worktrees`, name `Variant Worktrees`, `when` `workspaceFolderCount > 0`, `visibility` `visible`.

`variant.variants` stays in `explorer` with its current `when` (`workspaceFolderCount > 0 && !variant.onboardingOpen`) and `visibility` `collapsed`. The panel view's `when` omits `variant.onboardingOpen`, so the tree stays in the panel while the Explorer shows the onboarding webview. `Onboard` already runs `variant.onboardingInit`, which reveals the Explorer dialog; nothing in the panel view is replaced.

Alternative considered: move `variant.variants` into the panel. That removes the Explorer section, which this change keeps. Alternative: reuse the view id in both containers. The contribution point does not allow that.

### One provider, two tree views

`registerVariantsView` calls `createTreeView` a second time with `variant.worktrees` and the same `VariantsTreeProvider`. Both views subscribe to that provider's change event, so one `onDidChangeTreeData` refreshes both. Item commands stay registered once; each view passes the row as the command argument, so play, stop, implode, and the rest run once.

Alternative considered: a second provider or a second store. That duplicates refresh and can run an action twice. Rejected.

### Menus use a parenthesized view check

Each `view/title` and `view/item/context` entry that now says `view == variant.variants` becomes `(view == variant.variants || view == variant.worktrees)` and keeps the rest of the clause. Parentheses are required: a bare `||` would let the Explorer view show an item action even when `viewItem` does not match. Welcome entries cannot take `||`; copy the two `viewsWelcome` entries for `variant.worktrees`. Sort submenu bodies do not test `view` and stay as they are.

`variants-expand.ts` keeps focusing `variant.variants` only.

### Tests pin the contribution and the shared provider

Extend the manifest tests for the container, the second view's `when`, the duplicated welcome entries, and the parenthesized menu clauses. Extend the activation test so `createTreeView` is called with `variant.variants` and `variant.worktrees`. Extend the view test so both calls receive the same provider. Do not copy the row, sort, or action scenarios; those already cover the provider.

## Risks / Trade-offs

- [Bare `||` in a menu `when`] → Parentheses around the view check, asserted by the manifest test.
- [A png tab icon renders poorly] → `media/icon-128.png` is already the published small mark. If the host rejects it, switch that one path to an svg of the same mark. No behavior change.
- [Opening the panel view and the Explorer tree doubles `getChildren`] → The provider reads one store. No second list or watch.
- [A restored panel layout from a previous session] → Startup still does not call `variant.worktrees.focus`. The host may show a container the person left open. That is existing host behavior.

## Migration Plan

No stored state and no command rename. Shipping the extension adds the panel tab; the Explorer section stays. Rollback is reverting the contribution, the second `createTreeView`, and the menu `when` clauses. Users who pinned the panel tab lose that tab on rollback and keep the Explorer section.
