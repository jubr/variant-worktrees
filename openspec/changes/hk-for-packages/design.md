## Context

See proposal.md - Why. Today a single root `hk.pkl` (hk 1.56.1) carries one Biome step with a glob over
`packages/*/src` and `packages/*/test`, plus `commitlint`, `test`, `build` and `docs:build`. `task lint` already runs
`biome check packages/` through the root `biome.json`. The workspace `build` and `test` scripts run package builds in a
fixed dependency order (config, log, ipc, api, server, cli, ...), because later packages import earlier `dist/`.

A reference project nests `hk.pkl` files with `subprojects = List(...)` on hk 2.8.0; its plan names steps `app:eslint`,
`server:test`. `hk` 1.56.1 has no `subprojects`.

## Goals / Non-Goals

**Goals:**

- One definition of the per-package steps, applied to all twelve packages.
- Package tests that run concurrently, after the workspace build.
- A new package fails a test until it has an `hk.pkl` and a `subprojects` entry.
- Plan output that names the package for every lint step.

**Non-Goals:**

- Per-package `build` steps.
- Changing Biome rules, `biome.json`, or the `bun run lint` scripts.

## Decisions

1. **Shared module amended by each package.** A root `hk.package.pkl` amends hk's `Config.pkl` and defines the
   `check`, `fix` and `pre-commit` hooks with the Biome step, and the `check` hook with the `test` step. Each `packages/<name>/hk.pkl` is
   `amends "../../hk.package.pkl"`. A package that later needs an extra step overrides one hook in its own file.
   Alternative: every package imports a `linters` mapping and repeats the `hooks { }` block. Rejected: repeats about
   fifteen lines twelve times, and the hook wiring is the part that should not drift. Fallback if `hk` cannot load a
   local amended module: package files import the shared mapping and declare the hooks.

2. **Biome step scoped by cwd.** In a nested project hk passes paths relative to the package, so the shared step uses
   `glob = List("src/**/*.ts", "src/**/*.tsx")` and the existing excludes. Biome finds the root `biome.json` by walking up;
   its `files.includes` is root-relative and already matches the package files. This aligns the hk glob with
   `task lint`, which also covers `.tsx` in `variant-ui`.

3. **Package tests are nested steps; the build is one root step they depend on.** The shared `test` step runs
   `bun run test` in the package directory, so each package's own script (including `VARIANT_OPEN=0` where set) is the
   single source of truth. The step has `profiles = List("ci")` and `depends = List("build")`. The root `build` step
   keeps calling the sequenced `task --silent build`, because package builds depend on each other's `dist/` and hk would
   run per-package builds in parallel. A scratch run of hk 2.8.0 showed that a nested step's `depends` resolves a root
   step by its unprefixed name, that `build` runs alongside the lint steps, and that the package tests start
   only after it has finished, concurrently with each other. The tests do not depend on each other. The `task test`
   entry point stays for people.
   Alternatives: root `exclusive` build (also holds the lint steps back until it finishes; rejected), per-package
   `build` steps with `depends` (duplicates the order that `package.json` `build` already encodes; rejected).

   The root also gets a `test:scripts` step (`bun test scripts`, `ci` profile, `depends = List("build")`) for the
   repository script tests that `task test` runs after the package tests. `docs:build` stays a root step in the `full`
   profile.

4. **`subprojects = List("packages/*")`.** hk accepts globs, so a new package directory with an `hk.pkl` is picked
   up without editing the root. The test compares `packages/*/package.json` directories with the `hk.pkl` files and
   the plan, which also catches a missing `hk.pkl`.

5. **Contract test through `hk --plan`.** `scripts/hk-config.spec.ts` shells out to `hk ... --plan` (inspect-only) and
   asserts step names for the default, `ci`, `full` and pre-commit plans. It is skipped with a clear message when `hk`
   is not on `PATH`; mise provides it in CI. This tests the observable behavior and follows the colocated spec
   convention for `scripts/`.

6. **Pin bump.** `mise.toml` `hk = "2.8.0"` and both `amends`/`import` URLs move to `hk@2.8.0`. The `HK_MISE` and `HK`
   env settings stay. `.githooks` call `hk run pre-commit`, which is unchanged in 2.x.

## Risks / Trade-offs

- [hk 2.x changes a flag or hook behavior used by `.githooks` or `Taskfile`] → run `hk run pre-commit`, `task check:changed`,
  `task check:all` and `task check:full` after the bump before moving on.
- [Biome step in nested projects receives different path forms and misses root config] → verify with `hk check --all`
  on a deliberately mis-formatted file in two packages, then discard it.
- [Linting `.tsx` through hk surfaces findings hk did not see before] → they are already findings of `task lint`; fix
  or confirm there are none before enabling.
- [Twelve test steps at once load the machine, and some tests bind sockets or share fixtures] → they run under hk's `--jobs` limit; the first full run checks for interference, and a package that needs it can set `exclusive` in its own `hk.pkl`.
- [Twelve nested steps lengthen the plan] → they run in parallel and only on matching files.

## Migration Plan

Land the pin bump and configuration in one pull request. Contributors run `mise install` for the new `hk`. Rollback:
revert the pull request; the root glob step returns with hk 1.56.1.
