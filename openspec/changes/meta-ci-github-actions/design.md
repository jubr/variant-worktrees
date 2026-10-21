## Context

- Existing workflows: `ci.yml` (raw `bun run lint/build/test`, `main` + PR) and `docs.yml` (Pages deploy). See proposal.md for motivation.
- Local gates live in `Taskfile.yaml`/`hk.pkl` (`task check:full`: frozen-lockfile install, biome, commitlint over `origin/main..HEAD`, build, test, docs build). `AGENTS.md` says workflows call `task`, not raw `bun run`.
- Tools are mise-pinned (`mise.toml`: bun, task, hk, node, commitlint, openspec).
- Extensions package with `vsce package --no-dependencies` into `out/` (`variant-worktrees-<v>.vsix`, `chat-renamer-<v>.vsix`) via each package's `package` script.
- `bun build packages/variant-api/src/cli.ts --compile --outfile …` works once the workspace has been built (`variant-config` resolves through its `dist`), producing a ~64 MB executable that prints `--help`.
- All publishable packages are currently version `0.0.1`.

## Goals / Non-Goals

**Goals:**
- One gate definition, shared by feature builds and the release.
- Release is driven by a version bump, reviewed by a human before registry upload.
- Cross-platform CLI binaries from a single Linux runner.

**Non-Goals:**
- Reproducible-build attestation, SBOMs, artifact signing.
- Per-package independent versions and tags.

## Decisions

1. **mise installs tools in CI** (`jdx/mise-action`), then workflows run `task …`. Same pinned bun/task/hk/commitlint as local, no second tool list to drift. Alternative: `setup-bun` + ad-hoc installs; rejected because hk/task/commitlint versions would be duplicated.

2. **`ci-branch.yaml` (replaces `ci.yml`) is both trigger and `workflow_call`.** Triggers: `push` (all branches except `main`, which reaches CI through the release workflow so the gate does not run twice) and `pull_request` to `main`, plus `workflow_call`. The concurrency group includes `github.workflow`, so a call from release never shares a group with the branch's own run. `ci-release.yaml` calls it, so release never re-implements the gate. `concurrency` cancels superseded runs except on `main`. Checkout uses `fetch-depth: 0` so `task commitlint` can resolve `origin/main..HEAD`. A PR plus its branch push run twice; accepted, `pull_request` validates the merge ref. Alternative: `workflow_run` chaining; rejected, it loses the commit context and is harder to gate on.

3. **Packaging in CI = new tasks.** `task package:vsix` builds then packages both extensions into `out/`; `task package:cli` compiles `variant` with `bun build --compile`, taking `TARGET` (bun target, default host) and writing `out/variant-<version>-<os>-<arch>[.exe]`. Feature builds package the `.vsix` files on Ubuntu, and build only the macOS arm64 pre-release CLI in a separate job on a `macos-14` (arm64) runner, where `variant --help` runs natively as a smoke test; both then `upload-artifact`. Building darwin-arm64 on a native runner keeps feature builds cheap (one target) and executable. Alternative: build it on Ubuntu; rejected, the binary could not be smoke-tested. Reason: workflows stay thin and the same commands work locally.

4. **Cross-compile all release CLI targets on one Ubuntu runner** (`bun-linux-x64`, `bun-linux-arm64`, `bun-darwin-x64`, `bun-darwin-arm64`, `bun-windows-x64`, `bun-windows-arm64`) in the release build job. Bun downloads each target runtime; `bun-windows-arm64` compiles with the pinned Bun 1.4.2. Only the Linux x64 binary is executed there; the macOS arm64 binary is also executed by the reused `ci-branch.yaml` smoke job. Alternative: native matrix over OS runners; rejected for the cost and the slower, flakier macOS/Windows queue. Risk: a non-host binary is not run-tested (see Risks).

5. **Lockstep version via `scripts/release-version.ts`.** Reads the four `package.json` files, exits non-zero listing mismatches, prints the version otherwise. Exposed as `task release:version`. A `bun:test` covers agree/differ. Alternative: version only from `variant-vscode`; rejected, the tag would not represent the CLI or the second extension.

6. **`ci-release.yaml`**: trigger `push: branches [main]`. Jobs: `ci` (calls `ci-branch.yaml`) → `version` (runs `task release:version`, checks `gh release view v<version>` to set `exists`) → `build` (only if not exists; `package:vsix`, `package:cli` per target, `sha256sum` to `SHA256SUMS`) → `release` (`gh release create v<version> --target $GITHUB_SHA --generate-notes out/*`). Permissions default to `contents: read`; only `release` has `contents: write`. `ci-release.yaml` also has `workflow_dispatch` with a `dry-run` input (default true) that runs `build` and uploads assets as run artifacts but skips `release`. `concurrency: release` with no cancel so two merges cannot race on one tag. The idempotency check is the gate, not a tag-push trigger, so the release is created by the workflow and not by a human pushing tags.

7. **`publish-extensions.yaml`**: `workflow_dispatch` inputs `tag` and `registry` (`both|marketplace|openvsx`). Job runs in environment `marketplace` (required reviewers configured in repo settings). It downloads the `.vsix` assets of that release with `gh release download` and publishes with `vsce publish --packagePath` (`VSCE_PAT`) and `ovsx publish` (`OVSX_PAT`). It validates the tag/assets first. Publishing a prebuilt file guarantees the registry gets what was tested and released. `ovsx` and `vsce` run via `bunx` pinned versions; `vsce` is already a dev dependency.

8. **Action versions** pinned to major tags (`@v4` style) matching the existing workflows. SHA pinning is a possible later hardening.

9. **Validate workflows locally with `actionlint`** (added to `mise.toml`), run as a task `lint:workflows`, and wired into the CI gate so a broken workflow fails its own PR.

## Risks / Trade-offs

- [Cross-compiled darwin/windows/arm64 binaries are never executed in CI] → Release notes state this; follow-up can add a native smoke matrix. The compile step itself fails the job if a target cannot be built.
- [Bun downloads target runtimes at build time; network flake fails the release] → Job is re-runnable; the idempotent tag check makes re-runs safe.
- [`push` + `pull_request` doubles runs for PR branches] → Accepted; concurrency cancels superseded runs.
- [Unsigned macOS/Windows binaries trigger OS warnings] → Documented non-goal.
- [A merge that forgets a version bump releases nothing] → Intended; the run succeeds with a clear "already released" summary.
- [`GITHUB_TOKEN` events do not trigger other workflows] → Publish is manual by design, so no chaining is needed.

## Migration Plan

1. Land tasks, script, workflows on the feature branch; the PR itself exercises the feature-build path.
2. After merge, the first green `main` with a new version creates the first release (current `0.0.1` is unreleased, so it releases immediately).
3. A maintainer creates the `marketplace` environment with required reviewers and adds `VSCE_PAT`/`OVSX_PAT` before the first dispatch.
4. Rollback: revert the workflow files; delete a bad release and its tag with `gh release delete --cleanup-tag`. A registry publish cannot be undone, only superseded by a higher version.
