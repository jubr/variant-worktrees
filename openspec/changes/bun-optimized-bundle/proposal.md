## Why

Every compiled `variant` executable embeds the full Bun binary, about 65 MB, including the bundler, package manager, test runner and CSS engine that `variant` never uses at run time. Bun has an open pull request ([oven-sh/bun#32262](https://github.com/oven-sh/bun/pull/32262)) that adds a second, smaller build of the runtime (`bun-standalone`) for `bun build --compile` and cuts about 8 MB from it. We want to know, on a real build, whether the CLI works on that runtime and how much it saves, before upstream ships it.

## What Changes

- `task package:cli` and `task bleed:cli` accept an optional runtime executable, a locally built `bun-standalone`, and embed it in the compiled `variant` instead of the default Bun runtime.
- Without that option, nothing changes: same runtime, same output.
- The option is experimental, local, and opt-in. The release workflow does not set it.
- The Bun pull request is built for macOS arm64 from a clone outside the repository. The result is a measured size and a smoke test of the bled `variant`, recorded in the change's design notes. Nothing from the Bun build is committed here.
- A new workflow, `bun-standalone.yaml`, builds `bun-standalone` from the head of that pull request on GitHub-hosted runners (macOS arm64 and x64, Linux x64 and arm64) and attaches it to the run. It compiles only when the pull request head or the workflow file changed since the last build; otherwise it restores the cached binary.
- The CI workflow runs it as the job `Bun standalone` (shown as `ci / Bun standalone` in a release run), on `main` only. A manual dispatch of the release workflow from another branch can switch it on (`bun-standalone: yes`) to try it without merging.
- The release workflow compiles each `variant` executable in its own job. For Linux and macOS it tries to restore the cached `bun-standalone` of that platform and, if found, compiles with `VARIANT_BUN_RUNTIME`; if not, it compiles as today. Windows never gets it.
- Not in scope: Windows standalone builds, pinning or verifying the upstream pull request, making the slim runtime a required input of the release. A moved or closed pull request just means no cached binary and the default runtime.

## Capabilities

### New Capabilities

- `meta/bun-standalone-build`: when the workflow builds the slim Bun runtime from the pull request head, what it caches, and what it produces.

### Modified Capabilities

- `meta/release-artifacts`: the `variant` executables are compiled one platform per job and use the cached slim runtime when one exists (Linux and macOS only).
- `meta/dev-bleeds`: `bleed:cli` and `package:cli` can embed a caller-supplied runtime executable instead of the default one.

## Impact

- `scripts/package-cli.ts` (compile call) and its spec; `scripts/bleed.ts` only through the shared compile.
- `Taskfile.yaml` task descriptions, `CONTRIBUTING.md` (bleed note), `CHANGELOG.md`.
- `.github/workflows/bun-standalone.yaml` and its spec in `scripts/`; a scheduled run on the default branch costs a short job when nothing changed and a long one (macOS, two Linux runners) when something did.
- `.github/workflows/ci-branch.yaml` (one job, outputs, one input) and `.github/workflows/ci-release.yaml` (platform matrix, one input); `scripts/` workflow specs.
- No change to `variant` commands, flags or output, the CI gate, the release assets and their names, or the publish and signing workflows.
- Needs a Rust nightly toolchain, CMake, Ninja and several GB of disk on the machine that builds the Bun pull request.
