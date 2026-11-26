## Why

`variant.baseBranch` defaults to `main`, and `variant init` does not write it. In a repository whose default branch is `master` (or `develop`, `trunk`, ...), `variant create` then runs `git worktree add -b feat/<slug> <path> main` and fails with a bare *"Command failed: git ... worktree add ... main"*. The first command of a new user breaks, and every other command that reads the base branch (`create`, `provision`, `up`, `watch` with `--pull-ff`, `implode`) has the same blind spot, with or without a `variants.yaml`.

## What Changes

- The default of `variant.baseBranch` is detected instead of fixed: when `variants.yaml` does not set it, the resolved configuration carries the default git branch of the main checkout. This applies to every command, the library, the MCP tools and the editor, since they all resolve the configuration the same way. `variant config` shows that the value was detected.
- Detection reads local git state only (no fetch, no network), in this order: the branch `origin/HEAD` points at, the branch named by `init.defaultBranch` when it exists, a local `main`, a local `master`, then the branch the checkout has checked out (an unborn branch of a repository without commits included).
- When nothing is found (not a git repository, or a detached `HEAD` without any candidate), the default stays `main`.
- `variant init` writes the detected branch as `variant.baseBranch` in the new `variants.yaml`, with a comment that names the signal that found it, and the result (`detected`, JSON, YAML and the text line) names it.
- An explicit `variant.baseBranch` always wins and is never detected over.
- Non-goals: no fetch and no `git remote set-head`; no change to how `create`, `implode` or `--pull-ff` use the resolved value.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `variant-config/cfg-settings`: "Branch naming settings" resolves an unset `variant.baseBranch` to the detected default branch, `main` when none is found.
- `variant-api/init`: adds the requirement "Init writes the default branch".

## Impact

- `packages/variant-config`: one detector next to the other autodetection; `resolveVariant` uses it for the default; the origin comment of `variant config`; `renderInitConfig` writes `variant.baseBranch`.
- `packages/variant-api`: `InitResult.detected` carries `baseBranch` (the MCP tool `variant_init` returns it); the library default in `worktree.ts` used without a configuration is checked against the detector.
- `packages/variant-cli`: text output of `init` shows the branch.
- Docs: `README.md`, `docs/guide/commands.md` (`variant init`), `docs/guide/configuration.md` (`variant.baseBranch`), `CHANGELOG.md`.
