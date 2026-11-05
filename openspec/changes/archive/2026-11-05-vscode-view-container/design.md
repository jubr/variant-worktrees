## Context

See proposal.md for why. Today `contributes.views.explorer` holds `variant.variants` (the native tree) and `variant.onboarding` (the webview that replaces that section while onboarding is open). `registerVariantsView` builds one `VariantsTreeProvider` and one store, then calls `createTreeView("variant.variants", { treeDataProvider })`. Title and item menus are gated with `view == variant.variants`. Welcome content is keyed to that view id. Startup expand runs `variant.variants.focus` and then returns focus to the editor. **Variant: Open Variants Panel** is a separate webview (`variants-panel.ts`), not a view container.

A contributed view id belongs to one container. An activity-bar container requires an svg `icon`. `.vscodeignore` ignores every file, then whitelists the media the package ships. In a `when` clause, `&&` binds tighter than `||`.

## Goals / Non-Goals

**Goals:**

- Add the activity-bar container and a second view id with contribution JSON and one extra `createTreeView` on the provider that already exists.
- Ship `media/vw-mini-icon.svg` as that container's icon. No copy under `assets/brand`.

**Non-Goals:**

- Generating `package.json` menus, drawing a new icon, or a second provider.
- `viewsContainers.panel`.
- Focusing `variant.worktrees` from startup expand or from onboarding.
- Replacing `icon` (`media/icon-256.png`).

## Decisions

### Activity bar container, brand svg

`viewsContainers.activitybar` gets one entry:

```json
{
  "id": "variantWorktrees",
  "title": "Variant Worktrees",
  "icon": "media/vw-mini-icon.svg"
}
```

The icon file is `packages/variant-vscode/media/vw-mini-icon.svg`. It is not stored under `assets/brand`. The host resolves `icon` inside the extension, and `.vscodeignore` drops anything not whitelisted, so the whitelist gains `!media/vw-mini-icon.svg`.

`views.variantWorktrees` gets one view, id `variant.worktrees`, name `Variant Worktrees`, `when` `workspaceFolderCount > 0`, `visibility` `visible`.

`variant.variants` stays in `explorer` with its current `when` (`workspaceFolderCount > 0 && !variant.onboardingOpen`) and `visibility` `collapsed`. The activity-bar view's `when` omits `variant.onboardingOpen`, so the tree stays there while the Explorer shows the onboarding webview. `Onboard` already runs `variant.onboardingInit`, which reveals the Explorer dialog.

Alternative considered: `viewsContainers.panel` with `media/icon-128.png`. The container belongs on the activity bar, and its icon is the view svg, which already uses `currentColor`. Alternative: keep a second copy under `assets/brand`. The extension only needs the file it ships.

### One provider, two tree views

`registerVariantsView` calls `createTreeView` a second time with `variant.worktrees` and the same `VariantsTreeProvider`. Both views subscribe to that provider's change event, so one `onDidChangeTreeData` refreshes both. Item commands stay registered once; each view passes the row as the command argument, so play, stop, implode, and the rest run once.

Alternative considered: a second provider or a second store. That duplicates refresh and can run an action twice. Rejected.

### Menus use a parenthesized view check

Each `view/title` and `view/item/context` entry that now says `view == variant.variants` becomes `(view == variant.variants || view == variant.worktrees)` and keeps the rest of the clause. Parentheses are required: a bare `||` would let the Explorer view show an item action even when `viewItem` does not match. Welcome entries cannot take `||`; copy the two `viewsWelcome` entries for `variant.worktrees`. The `variant.noVariants` entry, on both views, is the text `Variants are not initialized, but no variants created yet.` and `[Onboard](command:variant.create)`. The `variant.noConfig` entry stays `[Onboard](command:variant.onboardingInit)`. Sort submenu bodies do not test `view` and stay as they are.

`variants-expand.ts` keeps focusing `variant.variants` only.

### Tests pin the contribution and the shared provider

Extend the manifest tests for the activity-bar container, the media svg, the whitelist line, the second view's `when`, the duplicated welcome entries, and the parenthesized menu clauses. Extend the activation test so `createTreeView` is called with `variant.variants` and `variant.worktrees`. Extend the view test so both calls receive the same provider. Do not copy the row, sort, or action scenarios; those already cover the provider.

## Risks / Trade-offs

- [Bare `||` in a menu `when`] → Parentheses around the view check, asserted by the manifest test.
- [Svg missing from the vsix] → Whitelist `media/vw-mini-icon.svg` and assert that line.
- [Opening the activity-bar view and the Explorer tree doubles `getChildren`] → The provider reads one store. No second list or watch.
- [The activity-bar icon is visible once the extension is installed] → Startup still does not call `variant.worktrees.focus`, so the Explorer stays the active sidebar.

## Migration Plan

No stored state and no command rename. Shipping the extension adds the activity-bar icon; the Explorer section stays. Rollback is reverting the contribution, the copied svg, the whitelist line, the second `createTreeView`, and the menu `when` clauses. The activity-bar icon disappears on rollback. The Explorer section remains.
