## Why

The Variant Worktrees trees list `main` and every worktree, but the highlighted row stays on the last click. A file open in the editor already sits in one of those directories, and the trees do not show which row that file belongs to, so play, stop, and implode are easy to run on the wrong variant.

## What Changes

- When the active text editor changes, and when the editor window gains focus, a file whose path is the main checkout or a variant worktree — or a path inside that directory — highlights that variant's row.
- The highlight is the tree's selection. It does not take keyboard focus from the editor.
- A tree that is not visible is not opened to show the row. When that tree becomes visible, it highlights the same row.
- The longest matching directory wins, so a file inside a worktree highlights that worktree when the main checkout is a parent of it.
- The editor that is already active when the trees exist is matched immediately, and a row that appears later is highlighted while that file stays active.
- A file in none of those directories, and an editor that is not a file, leaves the current highlight as it is.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `variant-vscode/variants-tree`: the Explorer section and the activity-bar tree select the variant row whose directory contains the active file, on active-editor change and on window focus, without focusing either tree.

## Impact

- `packages/variant-vscode`: the two trees (`variant.variants` and `variant.worktrees`) gain a selection driven by the active file and by whether each tree is visible. Path matching uses the row directory the trees already use for actions (the worktree, or the main checkout for `main`).
- Tests beside that selection, using the existing tree mock: active-editor changes, window focus, a hidden view, and a longer worktree path beating `main`.
- The tree paragraph in `packages/variant-vscode/README.md` and the same description in the root `README.md`. `CHANGELOG.md` and `packages/variant-vscode/CHANGELOG.md` record it under Unreleased.
- [specs/variant-vscode/variants-tree](../../specs/variant-vscode/variants-tree/spec.md).

## Non-goals

- Focusing the Explorer section, the activity-bar container, or the editor. Startup expand stays as it is.
- Revealing a hidden tree, or expanding a section the person has collapsed, only to show the highlight.
- Selecting the UI server row or the Database unreachable row from a file path.
- Moving the highlight when the cursor moves inside the same file, or when focus leaves the text editor for the tree, the terminal, or the sidebar.
- Clearing the highlight when the active file matches no variant.
- A setting to turn the behavior off.
- Opening the panel, a browser, or a URL.
