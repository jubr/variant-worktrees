## Context

See proposal.md for why. Today `packages/variant-cli/src/cli.ts` passes the `variant-cli` `package.json` `version` to cleye, and cleye prints that string for `--version`. The help header is `variant v` plus the same string (`packages/variant-cli/src/help.ts` only rearranges flag sections). `dist/cli.js` is produced by `bun build` in the package `build:js` script. `scripts/package-cli.ts` compiles `src/cli.ts` again with `Bun.build({ compile })`, and the runtime test copies `dist/` into a temp tree with no git metadata and compiles the executable into another temp path. A stamp read from the process working directory, or from git at runtime, is empty in both of those runs.

## Goals / Non-Goals

**Goals:**

- One function formats the `--version` line, including the `variant` suffix and the banner.
- `dist/cli.js` and the compiled executable each carry the date and commit from the build that produced them.
- A source run resolves the commit from the checkout that contains the CLI, not from the process working directory.
- Help keeps the package version cleye already receives.

**Non-Goals:**

- A network call to GitHub.
- Reading `git remote` to discover the URL.
- Failing the build when git is absent.
- An upgrade check, or coloring the version line.

## Decisions

**Print `--version` before cleye, and leave cleye's `version` as the package version.** cleye puts that option in the help header. Passing the parenthetical as `version` would make the first help line `variant v1.2.3 macos-arm64 (2001-02-03 https://github.com/jubr/variant-worktrees)`. The CLI handles a top-level `--version` itself and then returns. A `--version` after a subcommand is still cleye's unknown flag, which is the current top-level-only behavior. Alternative: pass the long string and strip parentheses inside the help renderer. Rejected: the renderer sees the rendered document, not a separate version field, so it would be parsing the header it is trying to protect.

**Bake the date and `variant` with Bun `define`, at both build entry points.** `VARIANT_BUILD_DATE` and `VARIANT_BUILD_VARIANT` are replaced in the `bun build` that writes `dist/cli.js` and in `compileCli`. In source, `typeof` on an identifier that was not defined is `"undefined"`, so the same module runs under `bun test` without a build. `hash4` is `HEAD` sliced to four lowercase hex characters. `git rev-parse --short` is not used, because git may print more than four characters when the prefix is ambiguous. Alternative: a generated TypeScript module written into `src/`. Rejected: it is easy to commit a stale stamp, and source tests would import the last build. Alternative: always call git at runtime. Rejected: the registry-like `dist/` copy and the compiled executable have no checkout.

**The platform token is the runtime, formatted like mise.** `darwin` is shown as `macos`, `win32` as `windows`, and `linux` as `linux`, then a hyphen and `process.arch` (`macos-arm64`, `linux-x64`). It is computed when `--version` prints, not baked, because a compiled executable runs on the platform it was built for. Alternative: `darwin-arm64`, matching the executable file name. Rejected: the requested line uses mise's `macos-arm64` token. Executable file names stay `darwin-*`.

**The `variant` string is baked next to the date.** On `main` the define is an empty string. On any other branch it is `{slug}-{n}-{hash4}`. `slug` reuses `sanitizeSlug` (`feat/version-details` becomes `version-details`). `n` is `git rev-list --count <tag>..HEAD` for the nearest tag from `git describe --tags --abbrev=0`, or `git rev-list --count HEAD` when no tag is reachable. `hash4` is the first four lowercase hex characters of `HEAD` and is not lengthened when that prefix is shared. The formatter appends `-{variant}` only when the string is non-empty, so a main build stays `1.2.3` and a feature build becomes `1.2.3-version-details-4-abcd`. The parentheses stay `({date} {url})` on every build, with no hash. A feature branch sitting on the tag (`n` of zero) still appends, because the string is `slug-0-hash4` and not empty. Alternative: hide the suffix when `n` is zero. Rejected: the branch is still not `main`, and the user asked to print the string whenever it is non-empty. Alternative: rename the executable with the suffix. Rejected: release asset names stay on the package version.

**The banner is a fixed cursive drawing, colored only on a terminal.** The glyphs for `variant-worktrees` live in the CLI as a constant, so `--version` does not need a font tool. The constant is the FIGlet `script` face below. A TTY with `NO_COLOR` unset wraps that drawing in orange ANSI (`38;5;208`) and resets before the version line. A pipe or `NO_COLOR` prints the glyphs unchanged. Alternative: omit the drawing when stdout is not a terminal, as mise does. Rejected: the drawing is part of `--version` even when captured. Alternative: generate the face at runtime with a figlet dependency. Rejected: the word does not change, and a dependency would have to be inside the compiled executable.

```text
                                                            _
                 o                                         | |
      __,   ,_       __,   _  _  _|_             __   ,_   | | _|_  ,_    _   _   ,
|  |_/  |  /  |  |  /  |  / |/ |  |-----|  |  |_/  \_/  |  |/_) |  /  |  |/  |/  / \_
 \/  \_/|_/   |_/|_/\_/|_/  |  |_/|_/    \/ \/  \__/    |_/| \_/|_/   |_/|__/|__/ \/
```


**The repository URL is a constant in the CLI, the package homepage.** It does not vary per commit, so it is not a `define`. Alternative: `git remote get-url origin`. Rejected: a released binary has no remote, and a fork's origin is not the project URL.

**Source fallback uses `git -C` on the directory of the CLI module.** The date is the UTC calendar date of the clock at the call (`YYYY-MM-DD`). If git cannot produce a full hexadecimal commit id, `variant` stays empty and the line is the version, the platform, and parentheses holding the date and the URL. The build and the compile do the same when they cannot read HEAD: they omit `VARIANT_BUILD_VARIANT`, and the artifact prints that same line. Alternative: fail `task build` without git. Rejected: a source archive has no `.git` directory, and the spec already allows the version-and-platform line.

**One stamp helper shared by the two builds.** `scripts/version-stamp.ts` reads HEAD, the branch, the commit count since the nearest tag, and the UTC date, and returns the `define` map for `VARIANT_BUILD_DATE` and `VARIANT_BUILD_VARIANT`. The CLI package build and `compileCli` both call it. The package `build:js` script cannot pass a computed `define` as it stands, so it becomes a small script that runs `Bun.build` with those defines and the flags the package script uses today (`--target node`, ESM, external `cleye`, `variant-api`, `variant-config`, `yaml`).

## Risks / Trade-offs

- [Scripts that require `--version` to equal the package version] → Called out as breaking in the proposal. Help and `-v` stay as they are, so the breakage is limited to that one line.
- [A source run and a `dist/` built on an earlier UTC day show different dates] → Intended. The artifact date is the build date; the source date is the run date.
- [A test that asserts today's UTC date can fail across midnight] → The pure formatter is tested with fixed inputs. The process test computes the expected date immediately before the run.
- [Only one of the two build paths gets `define`] → `dist/` and the executable would disagree. Both call the shared helper, and the Node, Bun, and compiled-executable test asserts the baked line outside the checkout.

## Migration Plan

No stored data and no flag rename. Shipping the CLI is the rollout. Reverting the change restores the version-only line; binaries already released keep the old line until the next release replaces them.

## Open Questions

None. The platform token, the `variant` suffix, the banner, the repository URL, the field order, and the source-run date are settled in the proposal and above.
