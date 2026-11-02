## Context

See proposal.md for motivation. Current state:

- `task version:incr:patch` (`scripts/version-incr.ts`) bumps the root, every `packages/*/package.json`, and `bun.lock`, and prints the new version. `task release:version` prints the lockstep version.
- `ci-release.yaml` runs on push to `main`, and when `v<version>` has no GitHub Release it builds assets and runs `gh release create "v${VERSION}" --target "$GITHUB_SHA" --generate-notes`. It creates the tag at the merge commit.
- Changelogs: root `CHANGELOG.md` (`## Unreleased`, no versions yet), `packages/variant-vscode/CHANGELOG.md` and `packages/chat-renamer-vscode/CHANGELOG.md` (`## [Unreleased]`, `## [x.y.z] - date`). The unmerged `keep-a-changelog` change makes `## [Unreleased]` canonical in all three; the script accepts both spellings so the two changes land in either order.
- `gh api repos/{owner}/{repo}/releases/generate-notes -f tag_name=v<next> -f previous_tag_name=v<prev>` returns the `What's Changed` pull request list without the tag existing. Verified against this repository.

## Goals / Non-Goals

**Goals:**

- One command a human or an agent runs; no skill, no hidden steps.
- Each step is a task that can run alone, so a failure is resumable.
- Scripts are unit-testable without network, using fixtures and a fake `gh`.

**Non-Goals:**

- Tagging (the release workflow does it at the merge commit), merging, publishing.

## Decisions

**Tasks composed from small scripts, not a skill.** `Taskfile.yaml` gets:

```yaml
release:check:       # bun scripts/release-prepare.ts check
release:changelog:   # bun scripts/release-changelog.ts
release:pr:          # bun scripts/release-prepare.ts pr
release:prepare:
  cmds:
    - task: release:check
    - task: version:incr:patch
    - task: release:changelog
    - task: release:pr
```

Alternative: one monolithic script. Rejected: a push failure would force a re-bump. With separate tasks the maintainer re-runs `task release:pr` after fixing the remote.

**`release:check`** runs before any write: branch is `main`, `git status --porcelain --untracked-files=no` empty (untracked files are never staged), `git fetch origin main` then `HEAD` is not behind `origin/main`, `scripts/release-version.ts` agrees, `gh auth status` succeeds. Fail messages name the problem.

**`release:changelog`** reads the new version from the root `package.json` (already bumped) and the previous release tag from the highest `v*` tag by version order (`git tag --list 'v*' --sort=-v:refname`, first one not equal to the new version). It calls `gh api` once for the notes, then edits each changelog found by globbing `CHANGELOG*.md` in the root and in `packages/*`. Per file: find the `Unreleased` heading (`## Unreleased` or `## [Unreleased]`), take the body up to the next `## ` heading, and replace it with an empty section followed by `## [<version>] - <date>` whose body is the old body plus `### Release notes` and the generated pull request lines (the `What's Changed` heading and the `Full Changelog` link line are dropped; the link is kept as a final line). Everything outside that span is byte-identical. No previous tag omits `previous_tag_name`. A file that already has a heading for the version aborts the run before any file is written (all files are computed first, then written). The date is the local date, injectable for tests; the notes fetcher is injectable for tests.

**`release:pr`** (`scripts/release-prepare.ts pr`) reads the version, runs `git switch -c release/v<version>`, `git add` of exactly the files a bump and changelog edit touch (`package.json`, `packages/*/package.json`, `bun.lock`, `CHANGELOG*.md`), `git commit -m "chore(release): v<version>"`, `git push -u origin`, and `gh pr create --base main --title ... --body-file`. The body is the generated notes, which `release:changelog` also writes to a file outside the repository tree (`$TMPDIR` path printed by the task) so the PR step does not call GitHub twice. Resumable: a branch that already exists locally is switched to instead of created, and the commit step is skipped when nothing is staged, so a retry after a failed push only pushes and opens the pull request.

**No pre-merge tag.** A tag pushed from the release branch would pin that commit rather than the merge commit CI builds, and would linger if the PR is abandoned. The decision was confirmed with the requester. Alternative kept open: a post-merge `task release:tag`; out of scope.

**GitHub notes written at prepare time, release body unchanged.** The release workflow keeps `--generate-notes`; the two lists are the same source. Repointing the release body at the changelog is the `keep-a-changelog` change.

**README image.** `packages/variant-vscode/README.md` loses its image line instead of switching to an absolute URL: the manifest `icon` already shows the icon on the extension page, so the image duplicates it. The root README keeps its repository-relative icon (GitHub resolves it). **Tagline.** The one-liner is changed in the manifest, both READMEs and `readme.spec.ts`; historical changelog text stays.

## Risks / Trade-offs

- [Notes list PRs merged after the bump PR is opened] → The list is a snapshot, and `task release:changelog` refuses to run again once the section exists. Mitigation: edit the section by hand before merge.
- [`gh` generate-notes API returns a different previous tag than the one passed when releases are non-linear] → The previous tag is passed explicitly, so the range is deterministic.
- [Squash-merged release PR rewrites the commit] → Irrelevant: no tag is pushed from the branch.
- [Changelog files diverge in style between packages] → The edit is anchored on the `Unreleased` heading only and tolerates both spellings.
- [`task release:prepare` run from a main worktree that other worktrees depend on] → It only creates a branch there; the maintainer switches back to `main` after the PR is opened.

## Migration Plan

Add the scripts and tasks, document them in CONTRIBUTING (Releasing). Rollback: remove the tasks and scripts; the manual flow (`task version:incr:patch`) is unchanged.
