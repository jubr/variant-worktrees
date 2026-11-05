## Why

The variants tree is only an Explorer section. Someone who keeps the sidebar on other views has to open the Explorer and expand **Variant Worktrees**. That same tree should also be its own activity-bar icon.

## What Changes

- Contribute an activity-bar view container titled `Variant Worktrees`, with icon `variant-worktrees-view-icon.svg`.
- Put a second native tree view in that container. It lists the same rows and offers the same welcome text, title actions, and item actions as the Explorer section.
- When `variant.noVariants` is set, that welcome says `Variants are not initialized, but no variants created yet.` and **Onboard** runs `variant.create`.
- One tree provider feeds both views. A refresh or an action updates both.
- Leave the Explorer section, its startup expand, and the onboarding dialog that replaces that section as they are.
- Leave the editor webview opened by **Variant: Open Variants Panel** as it is.

Non-goals:

- Removing the Explorer section or changing when it auto-expands.
- A second tree implementation, store, or command set.
- A `viewsContainers.panel` entry (the bottom panel, next to the terminal).
- Showing the onboarding webview in the activity-bar container.
- Focusing the activity-bar container on startup.
- Changing the webview Variants panel or the extension's 256px product icon.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `variant-vscode/variants-tree`: the same native tree is also a view in an activity-bar view container titled `Variant Worktrees`, using `variant-worktrees-view-icon.svg`.

## Impact

- `packages/variant-vscode` contribution (`viewsContainers.activitybar`, a second view, welcome entries, and menu `when` clauses), the svg copied into `media/` and whitelisted for the package, and `registerVariantsView`, which creates the second tree view on the existing provider.
- Manifest and activation tests that assert contributed views and `createTreeView` ids.
- The extension README and `CHANGELOG.md`, which today describe only the Explorer section.
