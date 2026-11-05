## Why

A variant whose clean implode would fail shows a muted explosion that does nothing, so the person cannot discard that work from the list. The row also has no control that opens its URL, and a failed watch, down, or implode is easy to miss when the only record is the log.

## What Changes

- Activating the muted explosion (`implodeClean` false) shows a non-modal notification: ``Clean implode failed, do you want to `--force`?`` with **Cancel** and **Force**. Cancel and dismissing the notification leave the variant in place. Force runs `implode` with `force` and does not open the clean-implode modal. A clean variant still uses that modal. `main` still has no explosion.
- Each variant row that has a URL gains an **Open url** button immediately left of its run control (play when down, stop when watching or up). The icon matches the section header's external-link button. A click opens that URL in the external browser, the same opener as the header's **Open Variants in Browser**. The tooltip is `Open url in external browser`. While Alt is held, the tooltip is `Open url in Cursor browser` and the click opens the URL in a Cursor browser tab. The row tooltip already names the URL. A native inline action has one title for every row, so the button tooltip does not append that row's URL.
- When watch, down, or implode fails, including a forced implode, a non-modal notification shows the error message. The extension log still records the failure.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `variant-vscode/variants-tree`: dirty implode offers force from a notification; an inline Open url control opens the external browser or a Cursor browser tab; watch, down, and implode failures show a non-modal error notification.

## Impact

- `variant-vscode`: the Variants tree inline actions, the dirty-implode command, and the open-URL action. `implode` already accepts `force` in `variant-api`; the extension starts passing it. No CLI or MCP flag change.
- User-facing copy in `packages/variant-vscode/README.md`, `docs/guide/core.md`, and `CHANGELOG.md` where they describe the muted explosion or the row actions.

Non-goals: the editor panel and the browser page; a force path in `variant-ui`; changing clean-implode confirmation; changing the header **Open Variants in Browser** command; changing the context-menu Open URL item; an auto-dismiss timer on the notification; imploding `main`.
