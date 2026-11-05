## Context

See proposal.md for motivation. The Explorer section is a native tree. Inline actions come from `view/item/context`. A disabled command in the `inline` group is omitted, so a dirty row contributes `variant.implodeDirty` (muted explosion) whose handler is a no-op. A clean row contributes `variant.implode`, which asks with `showWarningMessage` and `{ modal: true }` before `actions.implode(slug)`. `actions.implode` calls `client.implode(slug, { log })`. `VariantClient.implode` already accepts `force`. `attempt` already turns a thrown error into `showErrorMessage`, which is a non-modal notification. `variant.openUrl` is a context-menu command that calls `vscode.env.openExternal` on the record URL. The header command `variant.openInBrowser` opens the UI server URL with its token, not the row URL. Play is `inline@1` on `down`, stop is `inline@2` on `watching` or `up`, the explosion is `inline@9`.

The inline requirement text in this change is the current tree (one run control, explosion, muted dirty control) plus the new behavior. `openspec/specs/variant-vscode/variants-tree/spec.md` on this branch still describes the older trash icon. `openspec/changes/vscode-panel-usability` also replaces that requirement and is not archived.

## Goals / Non-Goals

**Goals:**

- Dirty explosion offers force from a non-modal notification and passes `force` through the existing client.
- Open url sits in `inline@0`. Alt shows the Cursor browser command and its tooltip.
- Watch, down, and implode failures keep a non-modal error notification. Tests lock watch, down, and forced implode, which the implode-failure test does not cover today.

**Non-Goals:**

- A new notification widget, a timeout, or a modal for the force prompt.
- Passing `force` from the panel or from `variant-ui`.
- Changing `variant.openInBrowser` or the context-menu title `Variant: Open URL`.
- A private workbench API, or replacing the tree with a webview.

## Decisions

**Force is the dirty command, not a second modal.** `variant.implodeDirty` calls `showWarningMessage` with the exact text ``Clean implode failed, do you want to `--force`?``, buttons `Cancel` then `Force`, and no `modal` option. `Cancel` and a dismissal (`undefined`) log `implode cancelled` and return. `Force` uses the same `attempt("implode", …)` path as a clean implode, and `actions.implode(slug, { force: true })` passes `{ force: true, log }` to `client.implode`. The clean modal stays on `variant.implode` only. Alternative: reuse the clean modal and add a Force button there — rejected, a dirty row must not open that modal. Alternative: call implode immediately — rejected, the notification is the confirmation.

**Open url is a second pair of commands, linked with `alt`.** The context-menu command keeps its short title. The inline item is a new command at `inline@0`, icon `$(link-external)`, `when` the item is a variant row whose context contains `has-url`. Its `alt` is the editor-tab command. The host shows and runs that command while Alt is held.

A normal click calls `vscode.env.openExternal` on the row URL, the same opener `variant.openUrl` uses. It does not call `variant.openInBrowser`. The `alt` command calls `simpleBrowser.api.open` with that URI, which opens the Simple Browser editor tab without a URL prompt. Cursor ships that command as Simple Browser: Show. A missing command rejects, and `attempt` shows the error. It does not fall through to the external browser. Alternative: `workbench.action.browser.open` — rejected, that id is not the stable extension API and may not take a URI the same way.

**The tooltip is the command title.** The external command's title is `Open url in external browser`. The editor-tab command's title is `Open url in Cursor browser`. A contributed title is one string for every row: the workbench has no per-item inline tooltip, and `resolveTreeItem` only sets the row tooltip, which already lists the URL. The button tooltip therefore does not append the URL. Tests lock the two titles, `alt`, the group, the `when` clause, and which opener runs. Alternative: a webview row so the button tooltip can carry the URL — rejected, the section stays a native tree.

**Failure notifications stay `showErrorMessage`.** No new channel. Watch, down, clean implode, and forced implode already go through `attempt`, or forced implode will once it uses `attempt`. The new tests are the lock. `showErrorMessage` is non-modal and has no buttons. Alternative: `withProgress` that closes itself — rejected, the request is the editor notification, and a force prompt with buttons cannot auto-close.

## Risks / Trade-offs

- [A contributed title cannot carry each row's URL] → The button tooltip is the sentence without the URL. The row tooltip still names the URL. No private API.
- [`simpleBrowser.api.open` is a different surface from Cursor's agent browser] → It is the editor tab the command palette already opens. A missing command shows the error notification and does not open the system browser.
- [Archiving `vscode-panel-usability` after this change replaces the whole Inline actions requirement and drops Open url and force] → Archive that change first, or merge this requirement text into its delta before that archive. This change's text is the superset of the current tree plus Open url and force.
- [Button order in a non-modal notification is the order passed, not a modal's primary-button placement] → Pass `Cancel`, then `Force`.

## Migration Plan

No setting and no stored state. Rollback is reverting the extension: dirty explode returns to a no-op, Open url disappears, and failure notifications stay as they are today. Variants already on disk are unchanged. `variant-api` does not migrate.

## Open Questions

None. The button tooltip is the shared command title, without the row URL. That is the decision above.
