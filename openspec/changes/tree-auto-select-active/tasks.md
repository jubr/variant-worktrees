## 1. Directory match

- [ ] 1.1 Add failing tests for [specs/variant-vscode/variants-tree | Active file selects its variant](../../specs/variant-vscode/variants-tree/spec.md#requirement-active-file-selects-its-variant) in `packages/variant-vscode/src/active-variant.spec.ts`. The matcher returns `demo` for `/work/_v-demo/src/a.ts` when that worktree is `/work/_v-demo`, returns `main` for a file in the main checkout, returns `demo` when the main checkout is a parent of `/work/_v-demo`, and returns none for `/work/_v-demo-extra/a.ts` against worktree `/work/_v-demo`. A missing path still compares. Verify `bun test packages/variant-vscode/src/active-variant.spec.ts` fails first.

- [ ] 1.2 Implement the pure matcher beside that spec: longest directory, `path.relative` boundary, `realpath` when the path exists and `path.resolve` otherwise. Verify the tests from 1.1 pass.

## 2. Tree selection

- [ ] 2.1 Extend `packages/variant-vscode/src/test/mock-vscode.ts` so `createTreeView` returns `visible` (default false), `selection`, and `onDidChangeVisibility`, and `window` exposes `activeTextEditor`, `onDidChangeActiveTextEditor`, and `onDidChangeWindowState` with a way for a test to fire each. In `packages/variant-vscode/src/variants-view.spec.ts`, add failing tests for the same requirement: a visible tree reveals the `demo` node with `{ select: true, focus: false }` when the active file is in that worktree, and the same for `main`; a hidden tree records no such reveal and does after it becomes visible; the activity-bar tree is not revealed while hidden; an already-active file selects on create; a later row selects without another editor event; a file outside every directory, a non-file editor, and a cursor move leave the previous reveal; no focus command runs. In `packages/variant-vscode/src/variants-tree.spec.ts`, `getChildren` returns the same variant node object for an unchanged slug. Verify `bun test packages/variant-vscode/src/variants-view.spec.ts packages/variant-vscode/src/variants-tree.spec.ts` fails on the new assertions, and the existing startup reveal stays `{ select: false, focus: false }` on `variant.variants` only.

- [ ] 2.2 Keep the last variant node per slug in `VariantsTreeProvider` and replace it only when the record changes. From `registerVariantsView`, map each row's `worktree` through the matcher (`main` with no `worktree` uses `variant.main` from the loaded client, never `ViewDeps.root`). Reveal that node with `{ select: true, focus: false }` only when `tree.visible` is true, skip when `selection` is already that node, and ignore a rejected reveal. Run on create, on active-editor change, on window focus, on store change while a file editor stays active, and when a tree becomes visible. Do not subscribe to selection changes inside a file, and do not clear the highlight when nothing matches. Dispose the listeners with the view. Verify the tests from 2.1 pass.

## 3. Copy

- [ ] 3.1 In the tree paragraphs of `README.md` and `packages/variant-vscode/README.md`, state that a focused file inside the main checkout or a variant worktree highlights that row in a visible Variant Worktrees tree and does not take editor focus. Add `## Unreleased` above the current version in `CHANGELOG.md` and `packages/variant-vscode/CHANGELOG.md`, with an **Added** bullet for the same behavior. Verify both READMEs contain that sentence and both changelogs have the Unreleased bullet.

## 4. Validation

- [ ] 4.1 Run `bun test packages/variant-vscode`, `openspec validate --all --strict --no-interactive`, and `task check:changed`. Verify each passes.
