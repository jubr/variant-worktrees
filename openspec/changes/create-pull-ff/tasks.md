## 1. Fast-forward before the worktree

- [ ] 1.1 Write failing tests in `packages/variant-api/test/` that use a local bare `origin` and no network. Cover: a checked-out `main` is fast-forwarded with local changes restored before the new branch exists, and that branch's HEAD is the updated tip; a caller whose cwd is another worktree still fast-forwards the primary checkout; a start branch checked out nowhere updates its ref and does not change existing worktree files; `from` naming a checked-out branch fast-forwards that checkout; a tag, a commit, and `HEAD` do not fetch; a diverged branch, a missing upstream, and a failed update leave no branch and no directory and the error names the failure, the repair, and a runnable `variant` command with `--pull-ff` and the slug (`--from` when it was set); an existing worktree, an existing prefixed branch, slug `main`, and an omitted `pullFf` do not fetch. Implement the update in `ensureWorktree` before `mkdir`, using `git pull --ff-only --autostash` in the checkout that has the start branch and `git fetch <remote> <upstream-branch>:<local-branch>` when it is not checked out. Verify with `bun test` on those `variant-api` tests.

## 2. Commands that create the worktree

- [ ] 2.1 Write failing client tests that `create`, `provision`, `up`, and `watch` with `pullFf: true` fast-forward the start branch before creating a new branch, and that a second call does not move an existing worktree. Add `pullFf?: boolean` beside `from` on those client methods and thread the command name, slug, `from`, and watch's `detach` and `reprovision` into the retry line. Verify with `bun test` on those operation tests in `variant-api`.

## 3. CLI, MCP, and forms

- [ ] 3.1 Write failing CLI tests that `create`, `provision`, `up`, and `watch` accept `--pull-ff` with no short flag and pass `pullFf: true`, that their `--help` lists `--pull-ff`, that omitting it leaves `pullFf` off the arguments, and that `down` and `implode` reject `--pull-ff`. Add the optional boolean on those four command definitions only. Verify with `bun test` on the CLI tests in `variant-cli`.
- [ ] 3.2 Write failing MCP tests that `variant_create`, `variant_provision`, `variant_up`, and `variant_watch` accept `pullFf` and that a create call with `pullFf: true` fast-forwards the start branch, and that `variant_down` and `variant_implode` reject `pullFf`. Verify with `bun test` on the MCP tests in `variant-mcp`. Extend the webview form test in `variant-ui` when it asserts the fields of one of those commands, and verify that test passes.

## 4. Docs and agent entry

- [ ] 4.1 Document `--pull-ff` on `create`, `provision`, `up`, and `watch` in the `README.md` CLI section, `docs/guide/core.md`, `docs/guide/library.md`, and `docs/mcp.md`: it fast-forwards the start branch before a new branch, it does not pull the new branch, a tag or commit is used as given, failure prints the command to run again, and omitted means no fetch. Add the entry under `## Unreleased` in `CHANGELOG.md`.
- [ ] 4.2 In `.agents/skills/vw-spec-start/SKILL.md`, remove the sync-base step that runs `git fetch` and `git pull --ff-only`. The workspace step SHALL be `variant create -s $slug --pull-ff`, plus `--from` only when the caller names a start. Mention `--pull-ff` on the create bullet in `AGENTS.md`. Leave the post-merge fast-forward in `vw-spec-wrapup` unchanged. Verify those files read that way.
- [ ] 4.3 Verify `task docs:build`, `task lint`, `task test`, `task build`, and `mise x -- openspec validate --all --strict --no-interactive` pass.
