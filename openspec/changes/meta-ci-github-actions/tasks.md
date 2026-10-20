## 1. Lockstep release version

- [ ] 1.1 Add a failing `bun:test` for [specs/meta/release-artifacts | Lockstep release version](../../specs/meta/release-artifacts/spec.md#requirement-lockstep-release-version): `scripts/release-version.ts` prints the shared version when the four package versions agree, and exits non-zero naming each package and version when they differ. Verify the test fails first.
- [ ] 1.2 Implement `scripts/release-version.ts` and `task release:version`. Verify the test passes and `task release:version` prints the current version.

## 2. Packaging tasks

- [ ] 2.1 Add `task package:vsix` (build, then package variant-worktrees and chat-renamer into `out/`). Verify `out/` holds `variant-worktrees-<v>.vsix` and `chat-renamer-<v>.vsix`.
- [ ] 2.2 Add `task package:cli` with a `TARGET` variable (default host) writing `out/variant-<version>-<os>-<arch>[.exe]` via `bun build --compile`. Verify the host binary runs `--help` and exits 0 outside the repo with no Bun on `PATH`.
- [ ] 2.3 Verify `package:cli` for all five release targets compiles and writes the expected file names.

## 3. Feature-branch CI

- [ ] 3.1 Add `actionlint` to `mise.toml` and a `task lint:workflows`. Verify it passes on the current workflows and fails on a deliberately broken one.
- [ ] 3.2 Rewrite `.github/workflows/ci.yml` per [specs/meta/ci-feature-builds](../../specs/meta/ci-feature-builds/spec.md): triggers `push`, `pull_request` to `main`, and `workflow_call`; mise setup; `fetch-depth: 0`; concurrency cancel off `main`; `task check:full`, `task lint:workflows`, `task package:vsix`, `task package:cli` plus `--help` smoke; `upload-artifact`. Verify with `lint:workflows` and a green run on this branch's PR with both `.vsix` and the executable attached.
- [ ] 3.3 Verify a deliberately failing gate on a throwaway commit turns the run red, then drop that commit.

## 4. Release workflow

- [ ] 4.1 Add `.github/workflows/release.yml` per [specs/meta/release-artifacts](../../specs/meta/release-artifacts/spec.md): `ci` → `version`/exists check → `build` (vsix, five CLI targets, `SHA256SUMS`) → `release` with least-privilege permissions and non-cancelling concurrency. Verify `lint:workflows` passes.
- [ ] 4.2 Verify the release path with a dry run on the PR branch (`workflow_dispatch` input `dry-run` builds assets and stops before `gh release create`), and verify the generated `SHA256SUMS` matches the assets locally.

## 5. Registry publication workflow

- [ ] 5.1 Add `.github/workflows/publish-extensions.yml`: `workflow_dispatch` with `tag` and `registry`, environment `marketplace`, asset validation, `vsce publish --packagePath`, `ovsx publish`. Verify `lint:workflows` passes and a dispatch with a bogus tag fails before any registry call.

## 6. Docs and validation

- [ ] 6.1 Document the release flow, required secrets and environment in `CONTRIBUTING.md` (Continuous integration section). Verify the doc lists all three workflows.
- [ ] 6.2 Run `task check:full`, `task lint:workflows`, and `openspec validate --all --strict --no-interactive`. Verify they pass.
