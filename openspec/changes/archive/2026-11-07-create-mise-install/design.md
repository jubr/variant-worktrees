## Context

See proposal.md for why. `client.create` calls `createVariant`. `watch` reaches it through `prepareVariant`. `provision` calls `ensureWorktree` itself, then provisions. Slug `main` and `worktree: false` produce no feature worktree. Mise is resolved by `resolveMiseBinary`. The editor trusts a directory with `mise -C <dir> trust --all`. `runMise` is synchronous. The CLI default log level is `warn`. Command arguments are one `CommandDefinition`. `collectArgs` copies only flags that were present.

## Goals / Non-Goals

**Goals:**

- Default every `create`, `provision`, and `watch` entry to `bg`.
- Run the install from the create path only, after the worktree exists, and only when that worktree has a Mise config.
- Let `provision` and `watch` pass `miseInstall` into that path.
- Keep the variant record's shape. Add no `variants.yaml` key.

**Non-Goals:**

- Installing from `up`.
- Killing an install that is already running.
- Choosing tools. `mise install` decides that.
- A new field on the variant record for the log path. The path is fixed.

## Decisions

### One install, three callers

The sequence lives in one helper called from `createVariant`. `watch` already calls `createVariant` and passes `miseInstall` through `prepareVariant`. `provisionVariant` calls the same helper after its worktree exists. `up` does not pass the option and does not call the helper.

Alternative: install inside `ensureWorktree`. Rejected. `up` uses that function and must not install.

### `bg` is the default at every entry

Omitted `miseInstall` on `create`, `provision`, and `watch` is `bg` in the library methods and in each command's execute function. `collectArgs` still leaves an omitted flag off the parsed arguments. An invalid value throws before `createVariant` and before `ensureWorktree`.

A direct `client.create` without the option is `bg`, not silence. Projects whose worktree has no Mise config stay silent anyway.

### Detect the config in the worktree

After the worktree exists, look only at that directory for `mise.toml`, `.mise.toml`, `.config/mise/config.toml`, `mise/config.toml`, or `.tool-versions`. Do not walk parents: a fixture under this repository must not inherit this checkout's `mise.toml`. No file means return without resolving Mise and without an error.

A config with no resolved executable fails the call. The worktree stays, because detection happens after it exists. The error names `variant.mise.binPath`. The binary is `resolveMiseBinary` for this client.

### One sequence, two waiting modes

Both modes run, with the parent's working directory unchanged:

1. `<mise> -C <worktree> trust --all`
2. Only when that exits 0: `<mise> -C <worktree> install`

Standard input is not the caller's. Neither invocation can prompt.

`sync` waits for both. Their combined output goes to standard error. A non-zero exit throws. The error includes that output. The worktree stays.

`bg` starts one detached child of the current runtime that runs the same sequence and is not waited on, so the CLI can exit. The child's output replaces `{worktree}/.cache/variant/mise-install.log`. If that child cannot be spawned, the call throws and the worktree stays. A later non-zero exit only shows up in the log. On start, write one line to standard error that says the install is in the background and includes the log path. Use standard error directly.

Alternative: a shell `&&` chain. Rejected. Windows builds have no `sh`. Alternative: append to the log. Rejected. The file should be this run.

### Tests stub Mise

Commit a `mise.toml` into the fixture when the test wants detection. Pass `miseBinPath` a stub executable. No network and no real Mise. The stub records its arguments and can sleep, exit non-zero, or write a marker when it finishes. A fixture with no Mise config asserts that the stub is never run.

### Agent entry

`.agents/skills/vw-spec-start/SKILL.md` deletes the tooling step that starts `mise install`. The workspace step is `variant create -s $slug --pull-ff --mise-install=bg`, plus `--from` only when the caller names a start. The tools section names `sync` and `no`. Renumber the later steps. `AGENTS.md` names the flag on the create bullet.

## Risks / Trade-offs

- [Every create of a Mise project starts an install] → `no` restores silence. A worktree with no Mise config does not start one.
- [Create trusts the worktree's Mise config] → The worktree is the caller's own checkout. The command is the editor's `trust --all`. The run cannot prompt.
- [Two background installs share one log] → The second replaces the file. The first process is not killed.
- [`sync` holds the command open for a full install] → That is the mode. `bg` is the default.
- [A failed `sync` leaves a worktree without tools] → The error names the failure. A later create runs again. Nothing is deleted.

## Migration Plan

No stored data changes. A caller who needs create to stay idle passes `no`. Rollback is reverting the change. The skill and `AGENTS.md` revert with it, which puts the manual install step back on the agent.

## Open Questions

None.
