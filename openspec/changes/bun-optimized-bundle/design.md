## Context

`scripts/package-cli.ts` compiles the CLI with `Bun.build({ compile })`; `bleed:cli` and `package:cli` both go through `compileCli`. With no override, Bun copies its own executable (about 65 MB on macOS arm64) into the output and appends the bundle. `Bun.build`'s `compile` option already takes an `executablePath` for the runtime to embed, so the hook needs no change in Bun.

The Bun pull request ([#32262](https://github.com/oven-sh/bun/pull/32262), measured by its author at about -7.6 MB on linux-x64, -11%) builds `bun-standalone` with `bun build`, `bun install`, `bun test`, the CSS engine and the dev server compiled out; `Bun.build` and `Bun.color` throw there. It keeps the single-file TypeScript transpiler, `Bun.serve`, `fetch`, `Bun.spawn` and `Bun.Glob`. Our non-test code under `variant-api`, `variant-cli`, `variant-server`, `variant-mcp`, `variant-config`, `variant-ipc` and `variant-log` uses only `Bun.spawn` and `Bun.Glob` from the `Bun.*` namespace. `Bun.build` is used only by the packaging script, which runs on the full Bun.

The PR publishes `bun-standalone` as a release asset and an npm package only after it merges. Until then the only source is a local build of the PR branch, from a shallow clone kept outside this repository.

## Goals / Non-Goals

**Goals:**
- Try the PR's standalone runtime for the compiled CLI on macOS arm64, and record size and a smoke-test result.
- Keep the hook small, opt-in, and invisible when unused.

**Non-Goals:**
- No download or pin of a standalone runtime by `variant` builds; the new workflow only builds and caches it.
- No change to release executables, the CI gate or release workflow, or the `--version` output.
- No change to the full-Bun toolchain that `mise` pins.
- No fix for Bun itself; a gap found in the PR is reported, not patched here.

## Decisions

- **Environment variable `VARIANT_BUN_RUNTIME`, not a CLI flag or Taskfile variable.** `bleed:cli` and `package:cli` share `compileCli`; one env var reaches both and `task:` passes the environment through. A `TARGET`-style task variable would need wiring into `bleed:cli` and the `all` loop. Alternative: auto-detect a sibling clone by path. Rejected: machine paths in committed code, and implicit behavior.
- **Validate in `compileCli` before compiling.** Missing or non-executable file fails with the path in the message, so `publishCli` never reaches its replace step and the existing "failed compile leaves directory unchanged" guarantee holds. Alternative: let Bun report the error. Rejected: the message does not name our variable and may still touch outputs.
- **Runtime and target must match.** When the variable is set the caller owns that match (macOS arm64 build for a macOS arm64 host). `compileCli` passes no `target` for the host default; with `package:cli all` the same executable would be embedded in every platform's output, so the variable is documented as a single-target aid and `package:cli:all` rejects it. Alternative: infer from the file's header. Rejected: more code than the experiment justifies.
- **Build the PR with its own scripts.** `bun run build:standalone` in the clone (release profile, `--standalone=on`) produces `build/release-standalone/bun-standalone`. The clone is a shallow fetch of the PR head, pinned by commit in these notes. Alternative: cherry-pick into a fork. Rejected: no reason to carry patches.
- **Measure, then decide.** Compare byte size of the stripped output against the current 65.3 MB bled binary, and run `variant --version`, `variant list`, `variant ui --detach` (page served), and `variant mcp` (initialize handshake) with the bled binary.

- **Workflow `bun-standalone.yaml`: schedule plus path-filtered push, build only on a cache miss.** The pull request is upstream, so no push event announces a new head. A scheduled run (the default branch only) resolves the head with the GitHub API; the binary cache key is `<platform>-<head sha>-<hashFiles of the workflow>`, so a moved head or an edited workflow is a miss and everything else restores. A push that changes the workflow file runs it on any branch, so an edit is verified where it is made. Alternative: poll with a separate trigger service. Rejected: more moving parts than a cron.
- **Resolve once, in a short job.** A `resolve` job reads the head sha and hands it and the key suffix to a matrix job, so every platform builds the same commit even if the pull request moves mid-run. The matrix jobs still start on a hit and skip every step after the cache restore; a restore costs seconds, which is accepted over a cross-platform cache lookup that depends on cache versioning.
- **Dependency and compiler cache restored by prefix, binary cache by exact key.** A stale dependency cache only costs time; a stale binary would be a wrong result.
- **Same build recipe as the local build.** LLVM 21.1.x, CMake, the pinned Rust nightly from the checked-out repository, Bun for the scripts, and `SDKROOT` on macOS. Alternative: reuse the upstream Buildkite pipeline. Rejected: it needs their agents and secrets.
- **Artifacts and caches.** The output is a run artifact per platform and the cached binary. The release restores the cache; nothing downloads artifacts.
- **Release compiles one platform per job.** `VARIANT_BUN_RUNTIME` fits one platform and `package:cli:all` refuses it, so the release `build` job becomes a matrix of six jobs running `task package:cli TARGET=<target>`, plus a job for the `.vsix` files and one that gathers everything into the unchanged `release-assets` artifact and checksum file. All stay on `ubuntu-latest`: Bun compiles for any target from there, and a Windows job does not restore a runtime at all.
- **How a release job finds the cache.** The `Bun standalone` job returns the head sha and the workflow hash; the release `ci` call passes them on; each job restores `bun-standalone-<platform>-<sha>-<hash>` with `fail-on-cache-miss` off. A hit sets `VARIANT_BUN_RUNTIME` through `GITHUB_ENV`; a miss sets nothing. Caches made on `main` are what a `main` release sees, which is why the compile job runs there first.
- **A runtime built for another platform than the runner.** The runtime is only copied into the output, so a Linux runner can embed a macOS binary; the first run on a branch shows whether that holds. If it does not, the macOS jobs move to macOS runners and nothing else changes.
- **Switch for trying it without merging.** The release workflow gets a `bun-standalone` input (`yes|no`, default `no`) that it hands to the CI call; the job runs when the ref is `main` or the input is `yes`. A dispatch from a branch is already a dry run, so it builds everything and releases nothing. Alternative: a branch name written into the workflow. Rejected: it would have to be removed before merge. The workflow also runs on its own for a push that edits it, so a branch push alone shows the compile.

## Risks / Trade-offs

- [Build needs a pinned Rust nightly, CMake, Ninja, WebKit prebuilts and many GB; a cold build may take most of an hour] → Run it once, in the background, from a clone outside the repo; the tasks stop and report if the toolchain cannot be installed.
- [The PR is open and its head moves; behavior and flags can change] → Record the commit built; treat all results as provisional.
- [The slim runtime lacks something the CLI needs at run time, e.g. an API reached through a dependency] → The smoke test covers every command family; a failure is recorded as a finding and the option stays opt-in.
- [Savings smaller than hoped on macOS (the PR numbers are linux-x64, non-LTO)] → Report the measured number; the hook costs a few lines either way.
- [A standing env var changes a bled binary without trace] → The bleed binary name is unchanged by design (it is a local aid); the measurement notes name the runtime used.

## Migration Plan

None for users; the option is off by default. Rollback is deleting the env var. If the PR lands upstream, a follow-up change can pin a released standalone runtime, fetch it, and apply it to release builds.

## Build notes

- Built PR head `f1a9925` (`1.4.0-standalone-canary.1+f1a99252a`) for macOS arm64 with `bun run build:standalone`; the stripped `bun-standalone` is 47,295,472 bytes (45.1 MiB), a Mach-O arm64 executable.
- Needed beyond the PR's own instructions: LLVM 21.1.x from the official release (Apple clang is 21.0), and `SDKROOT` set so that host-compiled helpers find the macOS SDK.
- `bun-standalone -e 'console.log(Bun.version, process.arch)'` prints `1.4.0-standalone arm64`. `bun-standalone build x.ts` exits 1 and says `bun build` is not available in this executable.

## Results (macOS arm64)

Compiled the same checkout twice, once with the released Bun 1.4.2 runtime and once with `VARIANT_BUN_RUNTIME` naming the standalone build above.

| Executable | Bytes | MiB |
| --- | ---: | ---: |
| `variant` with the default runtime | 65,909,106 | 62.9 |
| `variant` with `bun-standalone` | 50,977,634 | 48.6 |
| Difference | -14,931,472 | -14.2 (-22.7%) |

- The two outputs behave the same for `variant --version` (apart from the build timestamp), `variant list`, `variant ui --detach` (the page and an embedded script chunk are served; `--stop` ends it) and `variant mcp` (initialize, then `tools/list` returns the same 11 tools, nothing on standard error).
- The saving is larger than the 7.6 MB the pull request reports for linux-x64. The baseline here is a released Bun, not a full build of the same pull request commit, so the difference mixes the removed subcommands with build differences. A like-for-like number needs a full build of that commit.
- Not exercised: `variant watch`, `variant create` and the other lifecycle commands against a live database, and any platform other than macOS arm64.
- Verdict: the CLI runs on the slim runtime for every command family tried. Pursuing it for releases waits for an upstream release of the standalone binary (see the migration plan); until then the variable stays a local aid.

## Results (CI, branch dispatch)

Dispatch of `ci-release.yaml` from `feat/bun-optimized-bundle` with `dry-run` and `bun-standalone: yes`:

- Run [44785600269](https://github.com/jubr/variant-worktrees/actions/runs/44785600269) (cold cache): all four `Bun standalone` builds compiled (linux-arm64 about 8 min, darwin-arm64 about 15 min; linux-x64 spent about 18 min installing the toolchain first). Every platform job then restored the cached slim runtime and ran `Embed the cached slim runtime`; the two Windows jobs skipped both steps. Release assets were gathered and the release was skipped (dry run).
- The Linux runner embedded the macOS runtimes without trouble, so the fallback to macOS runners is not needed. The compiled macOS executables were not run.
- Run [44792533276](https://github.com/jubr/variant-worktrees/actions/runs/44792533276) (same head and workflow hash): `Compile bun-standalone` was skipped on all four builds; the smoke tests ran on the restored binaries.
- Executable sizes (artifact zips, bytes): linux-x64 29.9 M, linux-arm64 29.8 M, darwin-x64 21.2 M, darwin-arm64 19.5 M with the slim runtime; windows-x64 41.5 M and windows-arm64 38.4 M with the default runtime.

## Smaller runtime through sed patches

Bun has no Cargo feature left to switch off; the only gate is `cfg(bun_standalone)`. So the workflow patches the upstream checkout with `sed` (no fork) and prints a `diff -u` of every file. Local experiment on macOS arm64, `bun-standalone` and the `variant` compiled with it:

| Build | `bun-standalone` | `variant` |
|---|---|---|
| default Bun runtime | – | 65.9 MB |
| the pull request as is | 47.3 MB | 51.0 MB |
| `MinSizeRel`, C++ `-Os`, Rust `opt-level=z` | 41.0 MB | 44.7 MB |
| same with C++ `-Oz` | 38.9 MB | 42.6 MB |
| plus `Bun.Image` and `bun:ffi` stubbed | 38.1 MB | 41.8 MB |

- `Bun.Image` and `bun:ffi` use the codegen `standaloneStub` flag plus a stub module each; libjpeg-turbo, libspng, libwebp and TinyCC drop out of the link. `--tinycc=off` alone does not link, because the Rust `ffi` code still references TinyCC.
- Not done: the HTTP/2 and HTTP/3 fetch client (lshpack, lsquic, lsqpack, about 1.3 MB) has roughly 70 call sites in `bun_http`; shell, `Bun.sql`, Redis, `HTMLRewriter`, markdown and archive are about 0.1 to 0.2 MB each. Disabling crash-report upload did not change the size.
- JavaScriptCore (23 MB) is prebuilt and sets the floor.
- The sed expressions need GNU sed, so the macOS jobs install `gnu-sed`. A patch that matches nothing fails the step, so an upstream rewrite of those lines shows up as a red run instead of a silently larger binary.
- A spec runs the step on fixtures of the upstream lines; the same step applied to a clean checkout of the pull request head matches the local experiment apart from comments.
