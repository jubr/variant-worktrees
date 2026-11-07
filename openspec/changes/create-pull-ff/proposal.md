## Why

A new variant branch starts at whatever commit the start branch has locally. Agents currently fast-forward `main` themselves before `variant create`, and a stale start branch produces a worktree that is already behind. The create path should do that fast-forward when asked, and stop with a retry command when it cannot.

## What Changes

- Optional `pullFf` on `create`. When this call creates a new variant branch, it fast-forwards the start branch first, then creates the worktree from that updated tip.
- The same option on the commands that create a worktree because they imply `create`: `provision`, `up`, and `watch`.
- The CLI flag is `--pull-ff`. The library option is `pullFf`. The MCP tools and the generated forms take the same argument. No short flag.
- Omitted `pullFf` keeps today's create: no fetch and no pull.
- The start branch is `from` when that option names a branch, and `variant.baseBranch` otherwise. The fast-forward runs in the checkout that has that branch, with local changes stashed and restored. A start branch that is not checked out is fast-forwarded by updating its ref from its upstream. The new worktree is not pulled: its branch has no upstream.
- A start point that is a tag or a commit is used as given. `pullFf` does not fetch for it.
- Failure leaves no new branch and no new worktree. The error says what failed, how to fix that checkout, and the exact `variant` command to run again.
- An existing worktree for the slug, or an existing branch under any configured prefix, is checked out as it is. `pullFf` does not move it.
- `vw-spec-start` stops fetching and pulling `main` itself. Its create step passes `--pull-ff`.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `variant-api/core`: before a new worktree branch is created, `pullFf` fast-forwards the start branch. Failure creates nothing. Reuse of an existing worktree or prefixed branch is unchanged.
- `variant-api/commands`: `create`, `provision`, `up`, and `watch` accept an optional boolean `pullFf`. The CLI, MCP tools, and generated forms derive it from that definition.
- `variant-mcp/tools`: `variant_create`, `variant_provision`, `variant_up`, and `variant_watch` accept optional `pullFf`.

## Impact

- `variant-api`: `ensureWorktree` and the create path shared by `create`, `provision`, `up`, and `watch`. Those client methods gain `pullFf` beside `from`.
- `variant-cli` and `variant-mcp`: the flag and tool input come from the shared command definition. `variant-ui` forms follow that definition.
- Docs: `README.md` CLI section, `docs/guide/core.md`, `docs/guide/library.md`, `docs/mcp.md`, and `CHANGELOG.md`.
- Agent workflow: `.agents/skills/vw-spec-start/SKILL.md` drops the manual `git fetch` and `git pull --ff-only` step. `AGENTS.md` mentions `--pull-ff` on create.
- Non-goals: pulling or rebasing the new variant branch; merging when the start branch has diverged; changing `implode`'s merge base; a pull on `down`, `deprovision`, `implode`, `status`, `list`, `init`, or `config`; the post-merge fast-forward in `vw-spec-wrapup`.
