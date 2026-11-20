## Why

Every compiled `variant` executable embeds the full Bun binary, about 65 MB, including the bundler, package manager, test runner and CSS engine that `variant` never uses at run time. Bun has an open pull request ([oven-sh/bun#32262](https://github.com/oven-sh/bun/pull/32262)) that adds a second, smaller build of the runtime (`bun-standalone`) for `bun build --compile` and cuts about 8 MB from it. We want to know, on a real build, whether the CLI works on that runtime and how much it saves, before upstream ships it.

## What Changes

- `task package:cli` and `task bleed:cli` accept an optional runtime executable, a locally built `bun-standalone`, and embed it in the compiled `variant` instead of the default Bun runtime.
- Without that option, nothing changes: same runtime, same output.
- The option is experimental, local, and opt-in. The release workflow does not set it.
- The Bun pull request is built for macOS arm64 from a clone outside the repository. The result is a measured size and a smoke test of the bled `variant`, recorded in the change's design notes. Nothing from the Bun build is committed here.
- Not in scope: release executables for any platform, Windows or Linux standalone builds, a pinned Bun version, a download step for the standalone runtime, or making the slim runtime the default. Those wait for an upstream release of the standalone binary.

## Capabilities

### New Capabilities

### Modified Capabilities

- `meta/dev-bleeds`: `bleed:cli` and `package:cli` can embed a caller-supplied runtime executable instead of the default one.

## Impact

- `scripts/package-cli.ts` (compile call) and its spec; `scripts/bleed.ts` only through the shared compile.
- `Taskfile.yaml` task descriptions, `CONTRIBUTING.md` (bleed note), `CHANGELOG.md`.
- No change to `variant` commands, flags, output, or the release workflow.
- Needs a Rust nightly toolchain, CMake, Ninja and several GB of disk on the machine that builds the Bun pull request.
