## Context

See proposal.md for motivation. `registerVariantsView` builds one `VariantsTreeProvider` and two trees from it: `variant.variants` in the Explorer and `variant.worktrees` on the activity bar. Startup expand calls `reveal(undefined, { select: false, focus: false })` on the Explorer tree only (`variants-expand.ts`). The manifest starts that view collapsed. A variant row's directory is `record.worktree`; for `main` that is the main checkout. `withMain` invents a `main` row with no `worktree` when the library omits one. `ViewDeps.root` is the first workspace folder, which may be a variant worktree rather than the main checkout. `getChildren` returns a new node object on every call, and each variant `TreeItem` has a stable `id` of `variant:${slug}`. Extension tests run against `packages/variant-vscode/src/test/mock-vscode.ts`. Its `createTreeView` records `reveal` and has no visibility or editor-focus events.

## Goals / Non-Goals

**Goals:**

- Select the matching variant row in each tree that is already visible, with keyboard focus left on the editor.
- Keep startup expand's `reveal(undefined, { select: false, focus: false })` and never reveal `variant.worktrees` merely because a file is active.

**Non-Goals:**

- A host-level test. Assertions stay on the mock.
- Logging each selection.
- A command or setting for the behavior.

## Decisions

**Match directories in a pure function, then reveal.** A function takes the file path and the `{ slug, directory }` pairs and returns the slug whose directory contains the path, or none. Containment is the directory itself or a descendant: `path.relative` is empty or does not start with `..` and is not absolute, so `/work/_v-demo` does not contain `/work/_v-demo-extra`. The longest directory wins. Both sides are `realpath`'d when they exist, and `path.resolve`'d otherwise, so a symlink still matches and a missing file still compares. The rows come from the store: `record.worktree` for each variant, including `main`. A `main` row with no `worktree` uses `variant.main` from the resolved config of the client the view already loads. It does not use `ViewDeps.root`. A row with neither path is not a candidate. UI server and database-unreachable nodes are not candidates. Alternative: treat the workspace folder as `main`. Rejected — opening `_v-foo` would highlight `main` for files that sit only in that folder when `foo` has no directory yet.

**Select with `reveal(node, { select: true, focus: false })` only while `tree.visible` is true.** `TreeView.reveal` shows a hidden view, which would expand a collapsed Explorer section and would switch the activity bar to Variant Worktrees. A hidden tree stores nothing extra: when `onDidChangeVisibility` reports that it is visible, the same match runs. Skip `reveal` when that tree's selection is already the row. A `reveal` rejection is ignored so a refresh race does not notify. Alternative: `reveal` with `focus: true`. Rejected — that takes the editor, which startup expand was changed to avoid. Alternative: reveal hidden trees. Rejected — the highlight is not worth opening the sidebar.

**The provider returns a stable node per slug.** `getChildren` keeps the last `{ kind: "variant", record }` for a slug and replaces it only when the record changes. Selection reveals that object. A fresh object on every call is not an element the host already holds, so `reveal` would miss the row. `TreeItem.id` stays `variant:${slug}` until that row is selected and another file should select a different row. The host tracks the selection by that id and will not replace it. The selected row's id then gains a generation (`variant:${slug}#n`) and the tree refreshes, which drops the selection, and only then does `reveal` select the new row. The host rejects every `reveal`, including startup `reveal(undefined)`, unless `getParent` is a function. Every row is a root, so `getParent` returns undefined.

**Triggers are the active editor and window focus, not the cursor.** Subscribe to `onDidChangeActiveTextEditor` and to `onDidChangeWindowState` when `focused` is true. Run once after both trees exist, using the editor that is already active. Run again from `store.onDidChange` while a file editor stays active, so a row that appears later is selected. Do not subscribe to `onDidChangeTextEditorSelection`. Do not clear the selection when the active editor is missing or is not a `file` URI, or when the path matches nothing. A hand-picked row therefore stays until one of those runs selects a slug. The listeners are disposed with the view.

**The mock grows only the API this uses.** `createTreeView` gains `visible` (default false), `onDidChangeVisibility`, and `selection`. `window` gains `activeTextEditor`, `onDidChangeActiveTextEditor`, and `onDidChangeWindowState`, each with a way for a test to fire it. `reveal` rejects with the host's missing-`getParent` error when the provider has no `getParent`, and records the call otherwise. Existing startup tests leave the active editor unset, so they still see only the expand `reveal`.

## Risks / Trade-offs

- [A host shows a view when `reveal` runs on a collapsed tree] → Call `reveal` only when `visible` is already true. Startup expand remains the only `reveal(undefined)`.
- [`reveal` of `variant.worktrees` selects the activity bar] → That tree is revealed only after it is already visible.
- [Node identity drifts after a refresh and `reveal` rejects] → Reuse the node object per slug, and ignore a rejected `reveal`.
- [Window focus puts back the file's row over a hand selection] → That re-apply is the spec. A hand selection holds only until the next active-editor change, window focus, or row-list change.
- [`realpath` of a path outside the workspace throws or is slow] → Fall back to `path.resolve` for a path that does not exist. One stat per focus change is enough; do not watch the filesystem.

## Migration Plan

No setting, no persisted key, and no data rewrite. The same change adds an Unreleased **Added** section to `CHANGELOG.md` and `packages/variant-vscode/CHANGELOG.md` (neither file has `## Unreleased` today; add it above the current version) and one sentence in the tree paragraphs of `README.md` and `packages/variant-vscode/README.md`. Rollback is reverting the commit. Nothing on disk has to be restored.
