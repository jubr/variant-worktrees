## Context

See proposal.md. `initProject` writes into the `cwd` it is given. The editor builds that client from the first workspace folder and never passes another directory. `resolveMainVscodeDir` already returns the main checkout's `.vscode` directory for a variant root, a linked worktree, and a single repo. `detectVariantMain` looks at the parent of its start directory, so it misses an `AGENTS.md` symlink that sits in the workspace folder itself. `configFromAgentsSymlink` also requires a `variants.yaml`, which is what init is about to create.

`ci-branch.yaml` has three jobs. `ci-release.yaml` calls that workflow, then runs `task package:cli:all` on its own Ubuntu job. Nothing in the release job downloads the feature-branch CLI artifact.

## Goals / Non-Goals

**Goals:**

- One directory value, computed in the extension, shared by `init`, the existing-file checkbox, adoption, and the commit watcher.
- Leave `initProject` writing only to the directory it is given.

**Non-Goals:**

- Changing `resolveMainVscodeDir` or teaching `initProject` to search.
- A new macOS job, or a change to `task package:cli` or `ci-release.yaml`.

## Decisions

### The extension picks the directory; the library does not

`init`, adoption, the checkbox, and the commit watcher receive one path. The library command stays "write in `cwd`". The CLI and MCP keep passing the process working directory.

Alternative: `initProject` walks to the main checkout when `cwd` has no `.git` directory. Rejected. That would change `variant init` and `variant_init` for every caller. The spec keeps those on the process working directory.

### The checkout is `dirname` of `resolveMainVscodeDir`

When `lstat` of `<workspace>/.git` is a directory, the onboarding directory is the workspace folder. Otherwise it is `dirname(resolveMainVscodeDir(workspace))`. That function already walks the workspace and its ancestors for an `AGENTS.md` symlink and for a single repo that holds the real `AGENTS.md`, and it does not need `variants.yaml`. Its fallback is `<workspace>/.vscode`, so `dirname` is the workspace folder and init stays there.

A `.git` file (linked worktree) fails the directory test, so the walk runs and lands on the main checkout.

Alternative: `detectVariantMain(workspace)`. Rejected for the variant-root case. It inspects the parent of the start directory, and the symlink is in the start directory.

Alternative: `configFromAgentsSymlink`. Rejected. It returns nothing until `variants.yaml` exists.

### CI drops the job and nothing else

Delete the `cli-prerelease` job from `ci-branch.yaml`. `gate` and `node-smoke` stay. Release still compiles every platform, including macOS arm64, and still smoke-tests the Linux x64 executable. Update the `CONTRIBUTING.md` sentence that names the feature-branch macOS executable so it does not describe a job that is gone.

Alternative: keep the smoke and drop only the artifact upload. Rejected. The job exists to produce that artifact; the request removes the job.

## Risks / Trade-offs

- [A broken macOS arm64 compile shows up on the release run, not on the feature branch] → Accepted. Release still cross-compiles that target. No feature-branch runner replaces the smoke.
- [A workspace that is a subdirectory of the main checkout has no `.git` directory of its own] → The ancestor walk returns the checkout root, and init writes there. That matches "find the main repo".
- [Adoption and the commit watcher move with init] → A container workspace starts watching the checkout's reflog and reads that checkout's environment. The opened folder is not watched. Specified.

## Migration Plan

No data migration. The next editor session uses the new directory. Rollback is reverting the extension change; files already written in a checkout stay, and a mistaken write in the variant root is a normal file delete.

The workflow change takes effect on the next push. Rollback is restoring the job. In-flight runs are unchanged. Release assets are unaffected.

## Open Questions

None.
