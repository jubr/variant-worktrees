## 1. Worktree start point

- [x] 1.1 Write failing tests that a new worktree branch starts at `from` (branch name and commit id), that an omitted `from` still starts at `variant.baseBranch`, that an existing prefixed branch and an existing worktree stay on their current HEAD, that an unknown commit-ish leaves no branch and no directory, and that `HEAD` is the current worktree when that directory belongs to the repository and otherwise `variant.main`. Implement the resolve-then-add start point on `ensureWorktree`. Verify with `bun test` on the worktree tests in `variant-api`.

## 2. Operations that create the worktree

- [x] 2.1 Write failing client tests that `create(slug, { from })`, `provision`, `up`, and `watch` each start a new branch at `from`, that a second call with a different `from` does not move an existing worktree, and that `implode` without `force` still refuses a branch started off `variant.baseBranch`. Add `from` as the second argument of `create` and on the existing options of `provision`, `up`, and `watch`, and thread it through `createVariant`, `provisionVariant`, and `prepareVariant`. Verify with `bun test` on those operation tests in `variant-api`.

## 3. CLI, MCP, and forms

- [x] 3.1 Write failing CLI tests that `create`, `provision`, `up`, and `watch` accept `--from` with no short flag and pass it to `execute`, that their `--help` lists `--from`, and that `down` and `implode` reject `--from`. Add the optional string argument on those four command definitions only. Verify with `bun test` on the CLI tests in `variant-cli`.
- [x] 3.2 Write failing MCP tests that `variant_create`, `variant_provision`, `variant_up`, and `variant_watch` accept `from` and that a create or watch call with `from` starts the new branch at that commit. Verify with `bun test` on the MCP tests in `variant-mcp`. Extend the webview form test in `variant-ui` when it asserts the fields of one of those commands, and verify that test passes.

## 4. Documentation

- [x] 4.1 Document `--from` on `create`, `provision`, `up`, and `watch` in the `README.md` CLI section, `docs/guide/core.md`, `docs/guide/library.md`, and `docs/mcp.md`, including that an omitted value uses `variant.baseBranch`, that an existing branch is left in place, and that implode still merges against `variant.baseBranch`. Add the entry under `## Unreleased` in `CHANGELOG.md`. Verify `task docs:build`, `task lint`, `task test`, `task build`, and `mise x -- openspec validate --all --strict --no-interactive` pass.
