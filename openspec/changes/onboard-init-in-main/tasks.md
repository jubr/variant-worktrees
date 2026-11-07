## 1. Onboarding directory

- [x] 1.1 Add a failing test for [specs/variant-vscode/onboarding | Init runs in the main checkout](../../specs/variant-vscode/onboarding/spec.md#requirement-init-runs-in-the-main-checkout): an `AGENTS.md` symlink whose target directory contains `.git` resolves there even when `variants.yaml` is absent; sibling worktrees of one repository resolve to the first `git worktree list` path; a linked worktree (`.git` file) resolves to that primary worktree; a folder whose `.git` is a directory resolves to itself; a folder with no `.git` anywhere resolves to itself; two unrelated child directories that contain `.git`, and a symlink target that differs from the primary worktree, are reported as a choice rather than a single directory. Run `bun test` on that spec and see it fail.

- [x] 1.2 Implement that resolution with the symlink trace and `primaryWorktree`. Do not call `resolveMainVscodeDir`. The tests of 1.1 pass.

## 2. Wire onboarding

- [x] 2.1 Add failing tests that the dialog's `init`, the existing-`variants.yaml` checkbox, adoption, and the commit watcher all receive the directory from 1.2. Cover [specs/variant-vscode/onboarding | Variant root](../../specs/variant-vscode/onboarding/spec.md#scenario-variant-root), [specs/variant-vscode/onboarding | Existing file is the checkout's file](../../specs/variant-vscode/onboarding/spec.md#scenario-existing-file-is-the-checkouts-file), [specs/variant-vscode/onboarding | Notification follows the checkout](../../specs/variant-vscode/onboarding/spec.md#scenario-notification-follows-the-checkout), [specs/variant-vscode/onboarding | Doubt lists the directories](../../specs/variant-vscode/onboarding/spec.md#scenario-doubt-lists-the-directories), [specs/variant-vscode/onboarding | Chosen directory](../../specs/variant-vscode/onboarding/spec.md#scenario-chosen-directory), and [specs/variant-vscode/onboarding | Cancel the dialog](../../specs/variant-vscode/onboarding/spec.md#scenario-cancel-the-dialog), plus [specs/variant-api/init | Editor initializes the main checkout](../../specs/variant-api/init/spec.md#scenario-editor-initializes-the-main-checkout). Run `bun test` on those specs and see them fail.

- [x] 2.2 Pass that directory into the client `init`, the checkbox check, adoption, and the commit watcher. When 1.2 reports a choice, show a quick pick of those directories before any write; Cancel writes nothing. Do not change `init` so that the CLI or MCP searches for a checkout. The tests of 2.1 pass, and the existing `variant init` tests still write into the process directory.

## 3. Feature-branch CLI job

- [x] 3.1 Add a failing test for [specs/meta/ci-feature-builds | Extension packages on feature branches](../../specs/meta/ci-feature-builds/spec.md#requirement-extension-packages-on-feature-branches): `ci-branch.yaml` has no `cli-prerelease` job, no macOS runner, and no `variant` executable artifact; `gate` and `node-smoke` remain; `ci-release.yaml` still runs `task package:cli:all`. Run `bun test` on that spec and see it fail.

- [x] 3.2 Delete the `cli-prerelease` job. Update the `CONTRIBUTING.md` CI paragraph so it no longer names a feature-branch macOS `variant` executable. The tests of 3.1 pass, and `task lint:workflows` passes.

## 4. Notes and validation

- [x] 4.1 Add an `Unreleased` bullet in the root `CHANGELOG.md` and in `packages/variant-vscode/CHANGELOG.md` for init landing in the main checkout when the workspace folder has no `.git` directory, and a root bullet for dropping the feature-branch macOS CLI job. Confirm the bullets name both.

- [x] 4.2 Run `openspec validate --all --strict --no-interactive` and `bun test` for the specs in 1.1, 2.1, and 3.1. Both succeed.
