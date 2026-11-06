## Context

See proposal.md for why. Today `packages/variant-cli/src/cli.ts` passes the `variant-cli` `package.json` `version` to cleye, and cleye prints that string for `--version`. The help header is `variant v` plus the same string (`packages/variant-cli/src/help.ts` only rearranges flag sections). `dist/cli.js` is produced by `bun build` in the package `build:js` script. `scripts/package-cli.ts` compiles `src/cli.ts` again with `Bun.build({ compile })`, and the runtime test copies `dist/` into a temp tree with no git metadata and compiles the executable into another temp path. A stamp read from the process working directory, or from git at runtime, is empty in both of those runs.

## Goals / Non-Goals

**Goals:**

- One function formats the `--version` line.
- `dist/cli.js` and the compiled executable each carry the date and commit from the build that produced them.
- A source run resolves the commit from the checkout that contains the CLI, not from the process working directory.
- Help keeps the package version cleye already receives.

**Non-Goals:**

- A network call to GitHub.
- Reading `git remote` to discover the URL.
- Failing the build when git is absent.

## Decisions

**Print `--version` before cleye, and leave cleye's `version` as the package version.** cleye puts that option in the help header. Passing the parenthetical as `version` would make the first help line `variant v1.2.3 (YYYY-MM-DD abcdef01 https://github.com/jubr/variant-worktrees)`. The CLI handles a top-level `--version` itself and then returns. A `--version` after a subcommand is still cleye's unknown flag, which is the current top-level-only behavior. Alternative: pass the long string and strip parentheses inside the help renderer. Rejected: the renderer sees the rendered document, not a separate version field, so it would be parsing the header it is trying to protect.

**Bake the date and the full commit with Bun `define`, at both build entry points.** Two identifiers, `VARIANT_BUILD_DATE` and `VARIANT_GIT_HASH`, are replaced in the `bun build` that writes `dist/cli.js` and in `compileCli`. In source, `typeof` on an identifier that was not defined is `"undefined"`, so the same module runs under `bun test` without a build. The shown hash is the first eight characters of the full lowercase id, sliced in the formatter. `git rev-parse --short` is not used, because git may print more than eight characters when the prefix is ambiguous. Alternative: a generated TypeScript module written into `src/`. Rejected: it is easy to commit a stale stamp, and source tests would import the last build. Alternative: always call git at runtime. Rejected: the registry-like `dist/` copy and the compiled executable have no checkout.

**The repository URL is a constant in the CLI, the package homepage.** It does not vary per commit, so it is not a `define`. Alternative: `git remote get-url origin`. Rejected: a released binary has no remote, and a fork's origin is not the project URL.

**Source fallback uses `git -C` on the directory of the CLI module.** The date is the UTC calendar date of the clock at the call (`YYYY-MM-DD`). If git cannot produce a full hexadecimal commit id, the formatter returns the version alone. The build and the compile do the same when they cannot read HEAD: they omit the defines, and the artifact prints the version alone. Alternative: fail `task build` without git. Rejected: a source archive has no `.git` directory, and the spec already allows the version-only line.

**One stamp helper shared by the two builds.** `scripts/version-stamp.ts` reads HEAD and the UTC date and returns the `define` map. The CLI package build and `compileCli` both call it. The package `build:js` script cannot pass a computed `define` as it stands, so it becomes a small script that runs `Bun.build` with those defines and the flags the package script uses today (`--target node`, ESM, external `cleye`, `variant-api`, `variant-config`, `yaml`).

## Risks / Trade-offs

- [Scripts that require `--version` to equal the package version] → Called out as breaking in the proposal. Help and `-v` stay as they are, so the breakage is limited to that one line.
- [A source run and a `dist/` built on an earlier UTC day show different dates] → Intended. The artifact date is the build date; the source date is the run date.
- [A test that asserts today's UTC date can fail across midnight] → The pure formatter is tested with fixed inputs. The process test computes the expected date immediately before the run.
- [Only one of the two build paths gets `define`] → `dist/` and the executable would disagree. Both call the shared helper, and the Node, Bun, and compiled-executable test asserts the baked line outside the checkout.

## Migration Plan

No stored data and no flag rename. Shipping the CLI is the rollout. Reverting the change restores the version-only line; binaries already released keep the old line until the next release replaces them.

## Open Questions

None. The repository URL, the field order, and the source-run date are settled in the proposal and above.
