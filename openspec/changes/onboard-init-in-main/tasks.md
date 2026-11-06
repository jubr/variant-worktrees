## 1. Onboarding directory

- [ ] 1.1 Add a failing test for [specs/variant-vscode/onboarding | Init runs in the main checkout](../../specs/variant-vscode/onboarding/spec.md#requirement-init-runs-in-the-main-checkout): a folder with no `.git` and an `AGENTS.md` symlink into a checkout resolves to that checkout; a linked worktree (`.git` file) under that layout resolves to the same checkout; a `_v-*` worktree of a single repo whose root has a `.git` directory and a regular `AGENTS.md` resolves to that root; a folder whose `.git` is a directory resolves to itself; a folder with no `.git` and no checkout resolves to itself. Run `bun test` on that spec and see it fail.

- [ ] 1.2 Implement that resolution: a `.git` directory keeps the workspace folder; otherwise use the directory that contains the `.vscode` path from the existing main-checkout resolution. The tests of 1.1 pass.

## 2. Wire onboarding

- [ ] 2.1 Add failing tests that the dialog's `init`, the existing-`variants.yaml` checkbox, adoption, and the commit watcher all receive the directory from 1.2. Cover [specs/variant-vscode/onboarding | Variant root](../../specs/variant-vscode/onboarding/spec.md#scenario-variant-root), [specs/variant-vscode/onboarding | Existing file is the checkout's file](../../specs/variant-vscode/onboarding/spec.md#scenario-existing-file-is-the-checkouts-file), and [specs/variant-vscode/onboarding | Notification follows the checkout](../../specs/variant-vscode/onboarding/spec.md#scenario-notification-follows-the-checkout), plus [specs/variant-api/init | Editor initializes the main checkout](../../specs/variant-api/init/spec.md#scenario-editor-initializes-the-main-checkout). Run `bun test` on those specs and see them fail.

- [ ] 2.2 Pass that directory into the client `init`, the checkbox check, adoption, and the commit watcher. Do not change `init` so that the CLI or MCP searches for a checkout. The tests of 2.1 pass, and the existing `variant init` tests still write into the process directory.

## 3. Feature-branch CLI job

- [ ] 3.1 Add a failing test for [specs/meta/ci-feature-builds | Extension packages on feature branches](../../specs/meta/ci-feature-builds/spec.md#requirement-extension-packages-on-feature-branches): `ci-branch.yaml` has no `cli-prerelease` job, no macOS runner, and no `variant` executable artifact; `gate` and `node-smoke` remain; `ci-release.yaml` still runs `task package:cli:all`. Run `bun test` on that spec and see it fail.

- [ ] 3.2 Delete the `cli-prerelease` job. Update the `CONTRIBUTING.md` CI paragraph so it no longer names a feature-branch macOS `variant` executable. The tests of 3.1 pass, and `task lint:workflows` passes.

## 4. Notes and validation

- [ ] 4.1 Add an `Unreleased` bullet in the root `CHANGELOG.md` and in `packages/variant-vscode/CHANGELOG.md` for init landing in the main checkout when the workspace folder has no `.git` directory, and a root bullet for dropping the feature-branch macOS CLI job. Confirm the bullets name both.

- [ ] 4.2 Run `openspec validate --all --strict --no-interactive` and `bun test` for the specs in 1.1, 2.1, and 3.1. Both succeed.
