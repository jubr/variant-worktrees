## Context

See proposal.md for why. `client.create` calls `createVariant`, which `provision`, `up`, and `watch` also call through `prepareVariant`. The worktree path is on the record `create` returns. Slug `main` and `worktree: false` produce no worktree. Mise is already resolved by `resolveMiseBinary` (editor setting, `variant.mise.binPath`, `PATH`, then the usual locations). The editor trusts a directory with `mise -C <dir> trust --all`. The CLI default log level is `warn`, so an info log is hidden. Command arguments are one `CommandDefinition`; the CLI, MCP schema, forms, and shell completions all read it. `collectArgs` copies only flags that were present.

## Goals / Non-Goals

**Goals:**

- Run trust, then install, only from `create`, after that call has a worktree.
- Let the CLI and MCP omit the argument and still get a background run.
- Leave a library `create` that omits the option idle, so existing callers do not spawn Mise.
- Fail a missing executable before a new worktree exists.
- Keep the variant record's shape.

**Non-Goals:**

- Killing an install that is already running.
- Choosing tools. `mise install` decides that.
- A new field on the variant record for the log path. The path is fixed.

## Decisions

### Only the create command installs

`miseInstall` is an option on `client.create` and on the `create` command definition. The install runs after `createVariant` returns, in `client.create`, not inside `createVariant` or `ensureWorktree`. `provision`, `up`, and `watch` never see the option.

Alternative: install inside `createVariant`. Rejected. Those other commands would install whenever they made a worktree.

### The command fills `bg`; the library does not

`collectArgs` leaves an omitted flag off the arguments. The `create` execute function treats a missing `miseInstall` as `bg` and always passes `bg`, `sync`, or `no` into `client.create`. An MCP call that omits the property takes the same path. A direct `client.create` without the option does not install, the same as `no`.

Alternative: library default `bg`. Rejected. Every current test and extension caller of `create` would start Mise.

### Resolve Mise before creating a worktree

For `bg` and `sync`, resolve the executable first. Nothing found: throw, and do not create a worktree. Name the miss the way other missing-Mise errors do, including `variant.mise.binPath`. `no` and an omitted library option do not resolve. An invalid value throws in the same early check, before `createVariant`.

The binary is the one `resolveMiseBinary` already returns for this client (`miseBinPath` on the client when set).

### One sequence, two waiting modes

Both modes run, with the parent's working directory unchanged:

1. `<mise> -C <worktree> trust --all`
2. Only when that exits 0: `<mise> -C <worktree> install`

Standard input is not the caller's. Neither invocation can prompt.

`sync` waits for both. Their combined output goes to standard error. A non-zero exit throws after the worktree exists. The error includes that output. The worktree is left in place.

`bg` starts one detached child of the current runtime that runs the same sequence and is not waited on, so the CLI can exit. The child's output replaces `{worktree}/.cache/variant/mise-install.log`. If that child cannot be spawned, `create` throws and the worktree from this call stays. A later non-zero exit only shows up in the log. On start, write one line to standard error that says the install is in the background and includes the log path. Use standard error directly. An info log would not show at the default level.

Alternative: a shell `&&` chain. Rejected. Windows builds have no `sh`. Alternative: append to the log. Rejected. The file should be this run. A second overlapping create of the same worktree may clobber it.

### Tests stub Mise

Pass `miseBinPath` a stub executable. No network and no real Mise. The stub records its arguments and can sleep, exit non-zero, or write a marker when it finishes.

### Agent entry

`.agents/skills/vw-spec-start/SKILL.md` deletes the tooling step that starts `mise install`. The workspace step is `variant create -s $slug --pull-ff --mise-install=bg`, plus `--from` only when the caller names a start. The tools section names `sync` and `no`. Renumber the later steps. `AGENTS.md` names the flag on the create bullet.

## Risks / Trade-offs

- [Every CLI and MCP create now starts Mise] → `no` restores the old silence. The library method stays quiet unless asked.
- [Create trusts the worktree's Mise config] → The worktree is the caller's own checkout. The command is the editor's `trust --all`. The run cannot prompt.
- [Two background installs share one log] → The second replaces the file. The first process is not killed.
- [`sync` holds the command open for a full install] → That is the mode. `bg` is the default.
- [A failed `sync` leaves a worktree without tools] → The error names the failure. A later `create` with `sync` or `bg` runs again. Nothing is deleted.

## Migration Plan

No stored data changes. A caller of the CLI or MCP who needs create to stay idle passes `no`. Rollback is reverting the change. The skill and `AGENTS.md` revert with it, which puts the manual install step back on the agent.

## Open Questions

None.
