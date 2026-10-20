## Why

CI today is one workflow that runs raw `bun run lint/build/test` on `main` and PRs. It skips the repo's real gates (`task check:full`: commitlint, docs build), builds no extension package or CLI binary, and publishes nothing. The two VS Code extensions (variant-worktrees and chat-renamer) and the `variant` CLI can only be shipped from a developer machine, so nothing is ready to upload to the Visual Studio Marketplace or Open VSX.

## What Changes

- Feature branches and PRs run every CI gate through `task` targets, and also build both `.vsix` files and a pre-release `variant` single-file executable for macOS arm64 only.
- A green `main` builds both `.vsix` files (variant-worktrees, chat-renamer) and the `variant` CLI as Bun single-file executables (`bun build --compile`) for Linux (x64, arm64), macOS (x64, arm64), and Windows (x64, arm64), then publishes them with checksums as a GitHub Release tagged `v<version>`. A version whose tag already exists is not released again.
- A manually triggered, environment-gated workflow publishes the released `.vsix` files to the Visual Studio Marketplace and Open VSX. It never runs on its own.
- New `task` targets expose the packaging steps (`package:vsix`, `package:cli`, `release:version`) so workflows call tasks, not raw commands.
- A release version check requires the root package, `variant-api`, `variant-vscode`, and `chat-renamer-vscode` to share one version.

## Capabilities

### New Capabilities

- `meta/ci-feature-builds`: what every feature branch and PR build runs and proves.
- `meta/release-artifacts`: what a green `main` produces and releases, and how those artifacts are handed to the extension registries.

### Modified Capabilities

None.

## Impact

- `.github/workflows/ci.yml` is replaced by `ci-branch.yaml` (reusable); new `ci-release.yaml` and `publish-extensions.yaml`.
- `Taskfile.yaml` (packaging and release-version tasks), a small version-check script plus its test.
- `.vscodeignore`/package scripts only if packaging proves to need them.
- Repository settings outside the tree: `VSCE_PAT` and `OVSX_PAT` secrets in a protected `marketplace` environment.

## Non-goals

- Publishing to a registry automatically on merge.
- npm publishing of `variant-api`, `variant-config`, or `variant-mcp`.
- Signing or notarizing binaries, or building installers.
- Changing `docs.yml` (GitHub Pages deploy stays as is).
- Automating version bumps or changelog generation.
