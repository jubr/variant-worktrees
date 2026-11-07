## Context

See proposal.md. `initProject` writes into the `cwd` it is given. The editor builds that client from the first workspace folder and never passes another directory. `configFromAgentsSymlink` already follows an `AGENTS.md` symlink to a git checkout, then stops unless that checkout contains `variants.yaml`. `primaryWorktree` is the first path from `git worktree list`, which is the main checkout when linked worktrees are siblings. `resolveMainVscodeDir` is a different walk and is not used here.

`ci-branch.yaml` has three jobs. `ci-release.yaml` calls that workflow, then runs `task package:cli:all` on its own Ubuntu job. Nothing in the release job downloads the feature-branch CLI artifact.

## Goals / Non-Goals

**Goals:**

- One directory value, computed in the extension, shared by `init`, the existing-file checkbox, adoption, and the commit watcher.
- Leave `initProject` writing only to the directory it is given.

**Non-Goals:**

- Changing `resolveMainVscodeDir`, or teaching `initProject` to search.
- A new macOS job, or a change to `task package:cli` or `ci-release.yaml`.

## Decisions

### The extension picks the directory; the library does not

`init`, adoption, the checkbox, and the commit watcher receive one path. The library command stays "write in `cwd`". The CLI and MCP keep passing the process working directory.

Alternative: `initProject` walks to the main checkout when `cwd` has no `.git` directory. Rejected. That would change `variant init` and `variant_init` for every caller. The spec keeps those on the process working directory.

### Two existing finders, then a picker

When `lstat` of `<workspace>/.git` is a directory, the onboarding directory is the workspace folder. Otherwise:

1. If `<workspace>/AGENTS.md` is a symlink and the directory of the real file contains a `.git` entry, that directory is the checkout. Do not require `variants.yaml`. This is the checkout half of `configFromAgentsSymlink`, without the config-file check.
2. Otherwise, if child directories are worktrees of one repository, the checkout is `primaryWorktree` of any of them (the first `git worktree list` path). A lone child that contains `.git` is that checkout.
3. Otherwise the choice is in doubt: the symlink target and the primary worktree differ, or more than one child contains `.git` and they are not worktrees of one repository. Show a quick pick of those directories (each contains `.git`). The chosen path is the directory detection and `init` use. Cancel keeps the workspace folder and writes nothing.

A `.git` file fails the directory test, so a linked worktree falls through to rule 2 and lands on the primary worktree.

Alternative: `dirname(resolveMainVscodeDir(workspace))`. Rejected. That walk answers where the editor socket lives, not where `init` should write.

Alternative: `detectVariantMain(workspace)`. Rejected for the variant-root case. It inspects the parent of the start directory, and the symlink is in the start directory.

### CI drops the job and nothing else

Delete the `cli-prerelease` job from `ci-branch.yaml`. `gate` and `node-smoke` stay. Release still compiles every platform, including macOS arm64, and still smoke-tests the Linux x64 executable. Update the `CONTRIBUTING.md` sentence that names the feature-branch macOS executable so it does not describe a job that is gone.

Alternative: keep the smoke and drop only the artifact upload. Rejected. The job exists to produce that artifact; the request removes the job.

## Risks / Trade-offs

- [A broken macOS arm64 compile shows up on the release run, not on the feature branch] → Accepted. Release still cross-compiles that target. No feature-branch runner replaces the smoke.
- [The person dismisses the picker] → No file is written. Adoption and the commit watcher stay on the workspace folder until a directory is chosen.
- [Adoption and the commit watcher move with init] → After a checkout is chosen, they use that checkout. The opened folder is not watched. Specified.

## Migration Plan

No data migration. The next editor session uses the new directory. Rollback is reverting the extension change; files already written in a checkout stay, and a mistaken write in the variant root is a normal file delete.

The workflow change takes effect on the next push. Rollback is restoring the job. In-flight runs are unchanged. Release assets are unaffected.

## Open Questions

None.
