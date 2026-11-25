## Why

Every compiled `variant` executable embeds the full Bun binary, about 65 MB, including the bundler, package manager, test runner and CSS engine that `variant` never uses at run time. Bun has an open pull request ([oven-sh/bun#32262](https://github.com/oven-sh/bun/pull/32262)) that adds a second, smaller build of the runtime (`bun-standalone`) for `bun build --compile` and cuts about 8 MB from it. We want to know, on a real build, whether the CLI works on that runtime and how much it saves, before upstream ships it.

## What Changes

- `task package:cli` and `task bleed:cli` accept an optional runtime executable, a locally built `bun-standalone`, and embed it in the compiled `variant` instead of the default Bun runtime.
- Without that option, nothing changes: same runtime, same output.
- The option is experimental, local, and opt-in. The release workflow does not set it.
- The Bun pull request is built for macOS arm64 from a clone outside the repository. The result is a measured size and a smoke test of the bled `variant`, recorded in the change's design notes. Nothing from the Bun build is committed here.
- The slim runtime is built outside this repository, in [`jubr/bun-slim`](https://github.com/jubr/bun-slim), which publishes `bun-slim-vX.Y.Z-N` releases (zips per platform plus `SHA256SUMS`) for each Bun version. This repository builds no Bun.
- `package:cli` and `bleed:cli` choose the runtime of each target and print which: `VARIANT_BUN_RUNTIME` (one target), else for Linux and macOS the slim runtime fetched as `bun-slim-<os>-<arch>-v*.zip` from the newest build of the exact Bun version `mise.toml` pins (checked against `SHA256SUMS`), else the default runtime `bun-dist`. A missing release or a failed fetch is a warning; Windows says as information that it has no slim runtime.
- The release workflow compiles each `variant` executable in its own job with `task package:cli`, with the Bun version `mise.toml` pins. It has no fetch step and sets no variable.
- `variant --version` names the runtime with its version and build: `node`, `bun-v1.4.5`, `bun-standalone-v1.4.5-0` or `bun-slim-v1.4.5-0`.
- `task chore:bun:bump` moves `mise.toml`, `@types/bun` and `bun.lock` to the latest bun-slim release's Bun version (or `VERSION=`) and commits `chore(bun): bump to vX.Y.Z`.
- Not in scope: Windows slim builds, building Bun here. An earlier iteration built `bun-standalone` in this repository (`bun-standalone.yaml`, with `sed` patches); that moved to `jubr/bun-slim` and is gone.

## Capabilities

### New Capabilities

- `meta/bun-bump`: the task that moves the repository to another Bun version and commits it.

### Modified Capabilities

- `meta/release-artifacts`: the `variant` executables are compiled one platform per job and use the published slim runtime when there is one for the pinned Bun version (Linux and macOS only).
- `meta/dev-bleeds`: `bleed:cli` and `package:cli` can embed a caller-supplied runtime executable instead of the default one.
- `variant-api/commands`, `variant-cli/package`: the `--version` details line names the runtime.

## Impact

- `scripts/package-cli.ts` (`selectRuntime`, compile call), `scripts/bleed.ts`, `scripts/bun-slim.ts`, `scripts/fetch-bun-slim.ts`, `scripts/bump-bun.ts` and their specs.
- `Taskfile.yaml` (`chore:bun:bump`, task descriptions), `CONTRIBUTING.md`, `CHANGELOG.md`, the docs page "Bun standalone slim".
- `.github/workflows/ci-release.yaml` (platform matrix; the token for `package:cli`). No change to `ci-branch.yaml`.
- `packages/variant-api` and `packages/variant-cli` (`runtimeToken`, version line).
- No change to `variant` commands or flags, the CI gate, the release assets and their names, or the publish and signing workflows.
