## Context

`scripts/package-cli.ts` compiles the CLI with `Bun.build({ compile })`; `bleed:cli` and `package:cli` both go through `compileCli`. With no override, Bun copies its own executable (about 65 MB on macOS arm64) into the output and appends the bundle. `Bun.build`'s `compile` option already takes an `executablePath` for the runtime to embed, so the hook needs no change in Bun.

The Bun pull request ([#32262](https://github.com/oven-sh/bun/pull/32262), measured by its author at about -7.6 MB on linux-x64, -11%) builds `bun-standalone` with `bun build`, `bun install`, `bun test`, the CSS engine and the dev server compiled out; `Bun.build` and `Bun.color` throw there. It keeps the single-file TypeScript transpiler, `Bun.serve`, `fetch`, `Bun.spawn` and `Bun.Glob`. Our non-test code under `variant-api`, `variant-cli`, `variant-server`, `variant-mcp`, `variant-config`, `variant-ipc` and `variant-log` uses only `Bun.spawn` and `Bun.Glob` from the `Bun.*` namespace. `Bun.build` is used only by the packaging script, which runs on the full Bun.

The PR publishes `bun-standalone` as a release asset and an npm package only after it merges. Until then the only source is a local build of the PR branch, from a shallow clone kept outside this repository.

## Goals / Non-Goals

**Goals:**
- Try the PR's standalone runtime for the compiled CLI on macOS arm64, and record size and a smoke-test result.
- Keep the hook small, opt-in, and invisible when unused.

**Non-Goals:**
- No download, pin, or cache of a standalone runtime.
- No change to release executables, the CI workflows, or the `--version` output.
- No change to the full-Bun toolchain that `mise` pins.
- No fix for Bun itself; a gap found in the PR is reported, not patched here.

## Decisions

- **Environment variable `VARIANT_BUN_RUNTIME`, not a CLI flag or Taskfile variable.** `bleed:cli` and `package:cli` share `compileCli`; one env var reaches both and `task:` passes the environment through. A `TARGET`-style task variable would need wiring into `bleed:cli` and the `all` loop. Alternative: auto-detect `../_ref/...` by path. Rejected: machine paths in committed code, and implicit behavior.
- **Validate in `compileCli` before compiling.** Missing or non-executable file fails with the path in the message, so `publishCli` never reaches its replace step and the existing "failed compile leaves directory unchanged" guarantee holds. Alternative: let Bun report the error. Rejected: the message does not name our variable and may still touch outputs.
- **Runtime and target must match.** When the variable is set the caller owns that match (macOS arm64 build for a macOS arm64 host). `compileCli` passes no `target` for the host default; with `package:cli all` the same executable would be embedded in every platform's output, so the variable is documented as a single-target aid and `package:cli:all` rejects it. Alternative: infer from the file's header. Rejected: more code than the experiment justifies.
- **Build the PR with its own scripts.** `bun run build:standalone` in the clone (release profile, `--standalone=on`) produces `build/release-standalone/bun-standalone`. The clone is a shallow fetch of the PR head, pinned by commit in these notes. Alternative: cherry-pick into a fork. Rejected: no reason to carry patches.
- **Measure, then decide.** Compare byte size of the stripped output against the current 65.3 MB bled binary, and run `variant --version`, `variant list`, `variant ui --detach` (page served), and `variant mcp` (initialize handshake) with the bled binary.

## Risks / Trade-offs

- [Build needs a pinned Rust nightly, CMake, Ninja, WebKit prebuilts and many GB; a cold build may take most of an hour] → Run it once, in the background, from a clone outside the repo; the tasks stop and report if the toolchain cannot be installed.
- [The PR is open and its head moves; behavior and flags can change] → Record the commit built; treat all results as provisional.
- [The slim runtime lacks something the CLI needs at run time, e.g. an API reached through a dependency] → The smoke test covers every command family; a failure is recorded as a finding and the option stays opt-in.
- [Savings smaller than hoped on macOS (the PR numbers are linux-x64, non-LTO)] → Report the measured number; the hook costs a few lines either way.
- [A standing env var changes a bled binary without trace] → The bleed binary name is unchanged by design (it is a local aid); the measurement notes name the runtime used.

## Migration Plan

None for users; the option is off by default. Rollback is deleting the env var. If the PR lands upstream, a follow-up change can pin a released standalone runtime, fetch it, and apply it to release builds.
