## 1. Detect the default branch

- [x] 1.1 Red then green in `packages/variant-config/src/autodetect.spec.ts` (temp git repositories): `detectDefaultBranch` returns `origin/HEAD`'s branch (`develop`, and `release/2` with a slash) over a local `main`; `init.defaultBranch` only when that local branch exists; then `main`, then `master`; the checked-out branch for a repository without commits (`git init -b trunk`); `undefined` outside a git repository. Each result carries its `via`. Verify `bun test` of `variant-config` passes.
- [x] 1.2 Assert the detector runs no network command: a clone whose `origin` URL is unreachable still resolves from `origin/HEAD`. Verify the spec passes.
- [x] 1.3 Task-group commit (`feat(config): detect the default git branch`) with the code and tests of 1.1 and 1.2.

## 2. Resolved configuration uses it

- [x] 2.1 Red then green in `packages/variant-config/src/options.spec.ts` (or a sibling spec): with `variant.baseBranch` unset the resolved value is `master` in a `master`-only repository, `develop` with `origin/HEAD` at `origin/develop`, `main` outside git; a configured `release` wins over `origin/HEAD` and runs no git. Verify the spec passes.
- [x] 2.2 Red then green in the `variant config` specs: a detected value prints `# autodetect from origin/HEAD` (and the matching words for the other signals); a configured value prints no such comment. Verify the spec passes.
- [x] 2.3 High-level round trip in `variant-api`: in a repository whose only branch is `master` and a `variants.yaml` without `baseBranch`, `create` of a slug succeeds from `master`, and `implode` checks the merge against `master`. Check which production callers of `createWorktree` pass no branch settings (`DEFAULT_BRANCH_SETTINGS`) and route them through the resolved configuration. Verify `bun test` of `variant-api` passes.
- [x] 2.4 Task-group commit (`feat(config): detect variant.baseBranch when unset`).

## 3. Init writes `variant.baseBranch`

- [x] 3.1 Red then green in `packages/variant-config/src/init-config.spec.ts`: the text has `baseBranch: develop # from origin/HEAD`, `master # local branch`, `trunk # from init.defaultBranch`, `trunk # checked out`, and `main` when that is detected; no `baseBranch` outside git; `detected.baseBranch` matches; the text still loads and validates. Verify the spec passes.
- [x] 3.2 Red then green in `packages/variant-api/src/operations/init.spec.ts` and `packages/variant-cli/src/init.spec.ts`: `initProject` returns `detected.baseBranch`, JSON and YAML carry it, the text line shows `branch <name>`. Update the `InitResult` type and any MCP schema or spec that lists `detected`. Verify `bun test` of `variant-api`, `variant-cli` and `variant-mcp` passes.
- [x] 3.3 Round trip in `variant-api`: in a repository whose only branch is `master`, `initProject` then `create` of a slug succeeds from `master`. Verify the spec passes.
- [x] 3.4 Task-group commit (`feat(init): write the detected default branch`).

## 4. Docs, changelog and gates

- [x] 4.1 Update `README.md` (init paragraph and the `--from` / `variant.baseBranch` sentences), `docs/guide/commands.md` (`variant init`: the written branch), `docs/guide/configuration.md` (`variant.baseBranch`: default is detected, order, `git remote set-head origin -a`), and `CHANGELOG.md` under Unreleased, including the behavior note for files without `baseBranch`. Verify `scripts/docs-site.spec.ts` is green and the docs build passes.
- [x] 4.2 `openspec validate --all --strict --no-interactive` passes and `task check:all` passes.
- [x] 4.3 `task bleed:cli` publishes the binary. Show in chat, in a temp repository whose only branch is `master`: `variant create -s demo` succeeding with no `variants.yaml` base branch, `variant config` showing the detected `baseBranch` comment, then `variant init` printing `branch master` and the `baseBranch: master` line.
