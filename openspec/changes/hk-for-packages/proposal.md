## Why

The root `hk.pkl` runs one Biome step over a glob that spans every package, so `hk check` cannot tell which package a
finding or a skipped check belongs to, and a new package is linted only if someone widens that glob. The repository
has twelve packages and one lint configuration; each package should own its local checks the way nested projects do,
without twelve copies of the same configuration.

## What Changes

- Bump the pinned `hk` from 1.56.1 to 2.8.0 (the first line this repository needs for nested projects through
  `subprojects`) and move the `hk.pkl` `amends`/`import` URLs with it.
- Add one shared package configuration at the repository root. Each `packages/<name>/hk.pkl` is a one-line
  `amends` of it. The root `hk.pkl` lists the packages under `subprojects` (`packages/*`) and keeps the
  repository-wide steps (commitlint, workspace build, root script tests, docs build) and the hook-wide
  `fix`/`stash` settings.
- Move Biome lint/format from the root glob into the shared package configuration, so the plan shows one
  `<package>:biome` step per package.
- Run each package's tests as its own `<package>:test` step in the `ci` profile. The steps run concurrently, after
  the single workspace build step has finished.
- Add a contract test that evaluates `hk ... --plan` and fails when a package lacks its `hk.pkl`, is missing from
  `subprojects`, or a heavy check lands in the default or pre-commit plan.
- Keep `task check:changed`, `task check:all` and `task check:full`; rewrite their descriptions for the nested
  layout. Update `CONTRIBUTING.md` and `AGENTS.md` for the layout, the profiles, and the three tasks.

Non-goals: per-package `build` steps (the workspace build order stays one sequenced task), new lint rules, changing
`biome.json`, and per-package task names.

## Capabilities

### New Capabilities

- `meta/local-checks`: how the repository's local `hk` checks are laid out, which steps each package contributes, which
  steps each profile and hook runs, and the `task` entry points for them.

### Modified Capabilities

## Impact

- `mise.toml` (hk pin), root `hk.pkl`, new shared package `hk.pkl`, twelve `packages/*/hk.pkl`.
- `Taskfile.yaml` descriptions of `check:changed`, `check:all`, `check:full`.
- New `scripts/hk-config.spec.ts`; the root `test` step splits into the per-package `test` steps and a root script-test step. `CONTRIBUTING.md`, `AGENTS.md`.
- CI is unchanged: `ci-branch.yaml` already calls `task check:full`; the mise-installed `hk` follows the pin.
