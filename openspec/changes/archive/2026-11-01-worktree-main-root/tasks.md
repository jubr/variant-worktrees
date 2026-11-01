## 1. Main and root in the configuration

- [x] 1.1 Write failing `variant-config` tests for `variant.main` (explicit, symlink target, git carrying directory, non-git) and the new `variant.root` default (parent of a symlink into main, also from a linked worktree; symlink into another tree ignored; main otherwise; explicit root wins); implement `detectVariantMain`, `detectVariantRoot(configDir, main)`, the `main` schema key (with `variants.yaml.schema.json`) and `ResolvedVariant.main`, and verify `bun test` passes in `variant-config`

## 2. Operations use main and root

- [x] 2.1 Write failing `variant-api` tests that `ensureWorktree` adds the worktree to the repository of a given `main` from another working directory, and that `watch`/`create` run through a client in the symlink layout create `<parent>/_v-foo`; implement and verify they pass
- [x] 2.2 Write failing tests for the `.gitignore` scenarios (appended once, present entry kept in each spelling, comment not an entry, no file not created, custom prefix, root outside main untouched); implement `ignoreWorktrees` in `ensureWorktree` and verify they pass
- [x] 2.3 Make `list` read the main checkout from `variant.main` and verify the list and runtime tests still pass

## 3. Documentation

- [x] 3.1 Document `variant.main`, the `variant.root` default and the `.gitignore` entry in `README.md`, `docs/guide/configuration.md` and the `variants.example.yaml` comments, add the BREAKING entry to `CHANGELOG.md`, and verify `task docs:build`, `task lint`, `task test`, `task build` and `openspec validate --all --strict --no-interactive` pass
