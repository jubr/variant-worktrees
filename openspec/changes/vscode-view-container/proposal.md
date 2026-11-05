## Why

The variants tree is only an Explorer section. Someone who keeps the sidebar on other views, or who wants the list next to the terminal, has to open the Explorer and expand **Variant Worktrees**. That same tree should also be a tab in the bottom panel.

## What Changes

- Contribute a panel view container titled `Variant Worktrees`.
- Put a second native tree view in that container. It lists the same rows and offers the same welcome text, title actions, and item actions as the Explorer section.
- One tree provider feeds both views. A refresh or an action updates both.
- Leave the Explorer section, its startup expand, and the onboarding dialog that replaces that section as they are.
- Leave the editor webview opened by **Variant: Open Variants Panel** as it is.

Non-goals:

- Removing the Explorer section or changing when it auto-expands.
- A second tree implementation, store, or command set.
- Showing the onboarding webview in the panel container.
- Revealing or focusing the bottom panel on startup.
- Changing the webview Variants panel.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `variant-vscode/variants-tree`: the same native tree is also a view in a panel view container titled `Variant Worktrees`.

## Impact

- `packages/variant-vscode` contribution (`viewsContainers.panel`, a second view, welcome entries, and menu `when` clauses) and `registerVariantsView`, which creates the second tree view on the existing provider.
- Manifest and activation tests that assert contributed views and `createTreeView` ids.
- The extension README and `CHANGELOG.md`, which today describe only the Explorer section.
