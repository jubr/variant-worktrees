## Context

`loadConfig` resolves `variant.root` as the explicit value or `detectVariantRoot(configDir)`. That detector returns the main checkout: the directory of the real file behind a parent `AGENTS.md` symlink, else the git carrying directory with the real `AGENTS.md`, else the git common root, else `configDir`. `ensureWorktree` then creates `<root>/<prefix><slug>`, `locateWorktree` looks there, and `list` scans `<root>/<prefix>*` plus the primary worktree (found through git).

## Goals / Non-Goals

**Goals:**

- Name the two directories: `variant.main` and `variant.root`.
- Make the workspace layout produce `<parent>/_v-foo`.
- Keep worktrees inside a checkout out of `git status`.

**Non-Goals:**

- Moving existing worktrees. They are found by slug through `git worktree list`.
- Changing the worktree name, branch naming or `baseBranch`.

## Decisions

**`main` is the old detection, `root` is new.** `detectVariantRoot` becomes `detectVariantMain` with unchanged logic, and `variant.main` (explicit path relative to `variants.yaml`, else detected) is added to the schema and to `ResolvedVariant`. A new `detectVariantRoot(configDir, main)` returns the directory that holds the parent `AGENTS.md` symlink when that symlink's real target lies in `main` (`realpath` of the directory, compared by path containment), else `main`. An explicit `variant.root` wins as before. The symlink is looked up in the parent of `configDir`, so a linked worktree away from the main checkout still resolves to its own container.

Alternative: derive `root` as `dirname(main)` for every git checkout. Rejected by the requester: only the symlink layout means "worktrees live beside the checkout"; a plain repository keeps them inside it.

**Operations take `main` from the config.** `ensureWorktree(slug, cwd, root, prefix, branches, main?)` runs git in `main` when given and falls back to the primary worktree found through git for callers that pass nothing. `list` reads the main checkout's runtime state from `variant.main` instead of asking git again.

**`.gitignore` entry.** After `git worktree add`, `ignoreWorktrees(root, prefix, main)` runs when `root` equals `main` or lies inside it and `<root>/.gitignore` exists. It appends `<prefix>*` on its own line unless a non-comment line, trimmed of a leading `/` and a trailing `/`, already equals `<prefix>*`. It never creates the file and never touches one outside the main tree.

## Risks / Trade-offs

- [Symlink-layout users get a different place for new worktrees] → **BREAKING** changelog entry; `variant.root` pins the old place; existing worktrees stay reachable by slug.
- [`list` scans `<root>/<prefix>*` only, so old worktrees inside the main tree are not listed once the root moves to the parent] → `variant.root` pinned to the main tree keeps them visible; `list` stays as is.
- [A modified `.gitignore` makes the main checkout dirty] → only when the file exists and the entry is missing, and only once.

## Migration Plan

Release as pre-1.0 patch/minor with the BREAKING entry. Rollback is a revert; no stored state changes.
