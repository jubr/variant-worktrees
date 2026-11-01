## Why

`variant.root` mixes two things: the main git checkout the worktrees are made from, and the directory that holds the `_v-<slug>` worktrees. Detection always returns the main checkout, so with the workspace layout (a container directory whose `AGENTS.md` symlinks into the main checkout) `variant watch foo` puts `_v-foo` inside the main checkout, while the worktrees users keep by hand sit next to it, in the container. A worktree inside the checkout also shows up as untracked, because nothing git-ignores it.

## What Changes

- Add `variant.main`: the main tree the worktrees are made from. It is configurable and resolved like the old detection: the directory a parent `AGENTS.md` symlink targets, else the git carrying directory, else the directory of `variants.yaml`.
- `variant.root` now means only the directory that holds the worktrees, and gets a new default: the directory that holds the parent `AGENTS.md` symlink when that symlink targets the main tree (`<parent>/_v-foo`), otherwise the main tree itself (`./_v-foo`).
- **BREAKING** With the symlink layout, new worktrees go to `<parent>/_v-foo` instead of `<main>/_v-foo`. The resolved `variant.root` of `loadConfig` changes accordingly; callers that treated it as the main checkout use the new resolved `variant.main`. Set `variant.root` to the old main checkout to keep the old place.
- When a new worktree lands inside the main tree and a `.gitignore` exists there, `_v-*` (the configured prefix) is added to it unless already ignored. A `.gitignore` is never created.
- Operations use `variant.main` as the git repository they create worktrees in and as the main checkout whose runtime state `list` reads.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `variant-config/core`: worktree root resolution becomes main and root resolution; `variant.main` is accepted and resolved.
- `variant-api/core`: worktree coupling uses the main tree and git-ignores worktrees created inside it.

## Impact

- `packages/variant-config`: `src/schema.ts` (`main`), `src/autodetect.ts` (`detectVariantMain`, `detectVariantRoot(configDir, main)`), `src/index.ts`, `variants.yaml.schema.json`, `variants.example.yaml`, tests.
- `packages/variant-api`: `src/worktree.ts` (main parameter, `.gitignore` entry), `src/index.ts`, `src/operations/*` and `src/operations/list.ts` (main from config), tests.
- `README.md`, `docs/guide/configuration.md`, `CHANGELOG.md`.
- Specs: [specs/variant-config/core](../../specs/variant-config/core/spec.md), [specs/variant-api/core](../../specs/variant-api/core/spec.md).
- Overlaps with the open `command-status` change, which carried a first version of this fix; that change drops it once this one is merged.
