## 1. Changelog release notes

- [x] 1.1 Add failing `bun:test` cases in `scripts/release-changelog.spec.ts` for [specs/meta/release-artifacts | Changelog release notes](../../specs/meta/release-artifacts/spec.md#requirement-changelog-release-notes): Unreleased promoted (both `## Unreleased` and `## [Unreleased]`), empty Unreleased, notes lines under `### Release notes`, text outside Unreleased byte-identical, existing version section fails with nothing written, no previous tag. Use fixtures and an injected notes fetcher and date. Verify the cases fail first.
- [x] 1.2 Implement `scripts/release-changelog.ts` (all files computed before any is written; notes written to a body file). Verify the tests from 1.1 pass.

## 2. Preflight and release pull request

- [x] 2.1 Add failing `bun:test` cases in `scripts/release-prepare.spec.ts` for [specs/meta/release-artifacts | Release preparation task](../../specs/meta/release-artifacts/spec.md#requirement-release-preparation-task) and [Release pull request](../../specs/meta/release-artifacts/spec.md#requirement-release-pull-request), using a temporary git repository with a bare `origin` and a fake `gh` on `PATH`: `check` fails off `main`, on a dirty tree, behind origin, with differing versions, and with `gh` unauthenticated, each leaving files unchanged; `pr` creates `release/v<version>` with one `chore(release): v<version>` commit, pushes it, calls `gh pr create --base main` with that title and the notes body, creates no tag, and keeps the commit on the branch for a retry when the push fails, and a second `pr` run then pushes and opens the pull request without a second commit. Verify the cases fail first.
- [x] 2.2 Implement `scripts/release-prepare.ts` with `check` and `pr`. Verify the tests from 2.1 pass.

## 3. Tasks

- [x] 3.1 Add `release:check`, `release:changelog`, `release:pr` and `release:prepare` to `Taskfile.yaml`. Verify `task --list` shows them and `task release:prepare` on a dirty or non-`main` checkout fails in `release:check` before changing a file.

## 4. README image and tagline

- [x] 4.1 Update `packages/variant-vscode/src/readme.spec.ts` for [specs/docs/readmes | Extension description](../../specs/docs/readmes/spec.md#requirement-extension-description) and [Extension README has no relative images](../../specs/docs/readmes/spec.md#requirement-extension-readme-has-no-relative-images). Verify the new cases fail first.
- [x] 4.2 Set the new tagline in `packages/variant-vscode/package.json`, `packages/variant-vscode/README.md` and `README.md`, and remove the image line from `packages/variant-vscode/README.md`. Verify `bun test packages/variant-vscode/src/readme.spec.ts` and `product-icon.spec.ts` pass.

## 5. Docs and validation

- [x] 5.1 Document `task release:prepare` and its parts in `CONTRIBUTING.md` (Releasing) and record the change in `CHANGELOG.md`. Verify `CONTRIBUTING.md` names all four tasks.
- [x] 5.2 Run `task check:full` and `openspec validate --all --strict --no-interactive`. Verify both pass.
