## Why

Onboarding runs `init` in the editor's workspace folder. That folder is often the variant root: it has no `.git` directory, while the git checkout is the main repo the existing detection already finds. `init` then writes `variants.yaml`, `.gitignore`, and the mise entry beside the checkout instead of inside it.

Feature-branch CI also spends a macOS runner on a pre-release `variant` executable. The release workflow already builds that binary for every platform.

## What Changes

- When the workspace folder has no `.git` directory, onboarding chooses the checkout by tracing an `AGENTS.md` symlink to a directory that contains `.git`, or, failing that, by taking the primary worktree among sibling git worktrees. `init` runs in that directory.
- A `.git` file (a linked worktree) is not a `.git` directory, so that workspace also uses those two rules.
- When the two rules disagree, or more than one directory contains `.git` and neither rule picks a single checkout, a dialog lists the eligible directories and the person chooses where detection and `init` run. Cancel writes nothing.
- When the workspace folder has a `.git` directory, onboarding still runs `init` in that folder.
- When no eligible directory exists, `init` stays in the workspace folder.
- The same directory is used for the "already has `variants.yaml`" checkbox, adoption, and the one-time commit notification.
- `variant init` and `variant_init` still act on the directory they are given. Only the editor chooses a different directory.
- Remove the `cli-prerelease` job from `.github/workflows/ci-branch.yaml`. A feature-branch run no longer compiles, smoke-tests, or uploads a macOS arm64 `variant` executable. The gate, the Node smoke job, and both `.vsix` packages stay. Release still builds every platform executable.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `variant-vscode/onboarding`: the directory onboarding initializes when the workspace folder has no `.git` directory.
- `variant-api/init`: for the editor, that directory is the resolved checkout, not always the workspace folder. The library command still writes into the directory it is given.
- `meta/ci-feature-builds`: feature-branch packaging no longer includes the macOS arm64 CLI.

## Impact

- `packages/variant-vscode` onboarding (`onboarding.ts`, the dialog's `init` call, and their tests).
- The editor sentence of [specs/variant-api/init](../../specs/variant-api/init/spec.md).
- `.github/workflows/ci-branch.yaml`: delete the `cli-prerelease` job.
- `CONTRIBUTING.md` currently names that pre-release executable; it must match the workflow.
- `task package:cli`, `ci-release.yaml`, and the release asset set stay as they are.

## Non-goals

- Teaching CLI or MCP `init` to search for a main repo.
- Replacing the macOS feature-branch job with another runner.
- Writing `variants.yaml` into the variant root.
