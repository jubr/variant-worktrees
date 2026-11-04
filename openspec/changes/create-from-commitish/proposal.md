## Why

A new variant branch always starts at `variant.baseBranch`. Work that should continue from another branch, tag, or commit has to be created by hand and then adopted. `create` needs a start point, and so does every command that creates the worktree on the way to its own work.

## What Changes

- Optional `from` on `create`: a git commit-ish (branch, tag, or commit) resolved in the repository of `variant.main`. A new worktree branch is created from that commit instead of `variant.baseBranch`.
- The same option on the commands that create a worktree because they imply `create`: `provision`, `up`, and `watch`.
- The CLI flag is `--from`. The library option is `from`. The MCP tools and the generated forms take the same argument. No short flag.
- Omitted `from` keeps today's start point, `variant.baseBranch`. The branch name stays the first of `variant.branchPrefixes` plus the slug.
- An existing worktree for the slug, or an existing branch under any configured prefix, is checked out as it is. `from` does not move it.
- A `from` git cannot resolve fails the command. No new branch and no new worktree remain.
- `implode` still merges against `variant.baseBranch`. `from` does not change that gate.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `variant-api/core`: a new worktree branch starts at `from` when that option is set, and at `variant.baseBranch` otherwise. Reuse of an existing worktree or prefixed branch is unchanged.
- `variant-api/commands`: `create`, `provision`, `up`, and `watch` accept an optional string `from`. The CLI, MCP tools, and generated forms derive it from that definition.
- `variant-mcp/tools`: `variant_create`, `variant_provision`, `variant_up`, and `variant_watch` accept optional `from`.

## Impact

- `variant-api`: `ensureWorktree`, `create`, `provision`, and the prepare path shared by `up` and `watch`. `VariantClient.create` gains an options argument; `provision`, `up`, and `watch` gain `from` on their options.
- `variant-cli` and `variant-mcp`: the flag and tool input come from the shared command definition. `variant-ui` forms follow that definition.
- Docs: `README.md` CLI section, `docs/guide/core.md`, `docs/guide/library.md`, `docs/mcp.md`, and `CHANGELOG.md`.
- Non-goals: changing `variant.baseBranch` or branch prefixes; resetting or rebasing an existing variant branch onto `from`; a `from` prompt on the Explorer **Create variant** action (it keeps calling `create` with the slug only); `from` on `down`, `deprovision`, `implode`, `status`, `list`, `init`, or `config`.
