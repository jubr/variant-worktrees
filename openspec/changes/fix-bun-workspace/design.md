## Context

`prepareRun` in `variant-api/src/run-context.ts` builds the `VariantRun` whose `worktree` feeds `templateContext`, so `${worktree}` is whatever string `prepareVariant` and the provision operation hand it. That string comes from `createVariant(...).worktree` (already `resolve`d), `locateWorktree` (`primaryWorktree`, `resolve(found.path)`, or a `join(variantRoot, …)`), `repositoryDirectory` (returns `variant.main` or `context.cwd` unchanged) and `checkoutRoot` (falls back to the unresolved `cwd`). The configuration loader and the client already resolve `variant.main`, `variant.root` and `cwd`, so no current producer is known to hand over a relative path; the non-git fallback of `checkoutRoot` is the one unresolved spelling. The run is the one place that can promise the absolute path for every producer, present and future.

Host commands get `process.env` plus the variant variables (`commandEnvironment`). Mise contributes only dotenv values to configuration (`miseEnvironment`); it does not set `PATH` for children. The `PATH` a watch sees is therefore the one of the process that runs `variant`, which in an editor or a login shell with another Bun install can list a foreign directory before Mise's.

## Goals / Non-Goals

**Goals:**

- One place guarantees `${worktree}` is absolute and normalized.
- A wrong Bun on `PATH` is visible as a single warning before the first host command.

**Non-Goals:**

- Repairing `PATH`, running commands under `mise exec`, or checking other tools.
- A setting to silence the warning.

## Decisions

### Normalize in `prepareRun`

`prepareRun` applies `resolve()` to its `worktree` argument once and uses that value for `run.worktree`, `storage`, `projectDir`, and the template context. Callers stay unchanged. `resolve` is enough (no `realpath`): symlink targets are an existing concern of `isPrimary`, which already compares real paths, and resolving links would change the paths users see in `state.yaml`.

Alternative: fix each producer (`repositoryDirectory`, `checkoutRoot`). Rejected: a new producer would reintroduce the bug; the run is the choke point.

### Compare versions, not paths

Mise installs are often reached through shims or symlinks, so a path comparison would warn on a correct setup. The check compares `bun --version` of the first `bun` on the command `PATH` with the version from `mise ls --current --json bun` for the project directory. A mismatch then means commands really run another release. The warning still prints both paths, from `mise which bun` and from the `PATH` walk, because the path is what the user needs to fix.

Alternative: parse `mise.toml`. Rejected by the existing rule that Mise configuration files are never read for values; Mise also resolves `mise.local.toml`, parents and `.tool-versions`.

### Where it runs

A helper beside `mise.ts` takes the command environment, the project directory, the Mise executable (from `miseBinaryFor`) and `log`. `prepareVariant` calls it after `prepareRun` (covers `up` and `watch`), and the provision operation calls it before `runProvisioning`. Each probe is a short `spawnSync` with a timeout; any failure ends the check silently, consistent with "Mise missing" handling. The warning goes through the same `log` option as other operation lines, with the `warn` level of `variant-log`.

## Risks / Trade-offs

- A `bun --version` probe adds tens of milliseconds to the start of each operation → run once per operation and skip when Mise reports no Bun.
- A project that pins Bun through a range (`bun = "1"`) → Mise resolves the installed version in `ls --current`, so the comparison is against a concrete version.
- Warning noise for users who do not care → single line, no new setting; revisit if requested.

## Migration

None. No setting, state or output format changes; rollback is a revert.
