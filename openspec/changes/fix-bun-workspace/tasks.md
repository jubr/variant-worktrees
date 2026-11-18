## 1. Absolute `${worktree}`

- [ ] 1.1 Extend `packages/variant-api/src/run-context.spec.ts` with failing assertions for [specs/variant-api/provisioning | The worktree placeholder is an absolute path](../../specs/variant-api/provisioning/spec.md#requirement-the-worktree-placeholder-is-an-absolute-path). Cover: `prepareRun` with a relative worktree with `.` segments and a trailing separator yields the normalized absolute `run.worktree`; a watch `env.overrides` `SQLITE_DATABASE: '${worktree}/.cache/variant/${schema}.sqlite'` expands to an absolute path; a relative spelling with `..` expands like the absolute one. Verify with `mise x -- bun test packages/variant-api/src/run-context.spec.ts`: the new assertions fail.

- [ ] 1.2 Resolve the worktree once at the top of `prepareRun` and use it for `run`, `storage` and `projectDir`. Verify with the same `bun test` command: the file passes, and `mise x -- bun test packages/variant-api` still passes.

## 2. Bun on PATH matches Mise

- [ ] 2.1 Create `packages/variant-api/src/mise-bun.spec.ts` with failing assertions for [specs/tools/mise | Bun on PATH matches the Bun Mise pins](../../specs/tools/mise/spec.md#requirement-bun-on-path-matches-the-bun-mise-pins), using `src/test/mise-mock.ts` and stub `bun` executables in temp directories. Cover each scenario: other Bun first on `PATH` warns once with both versions and paths and the first directory; same version through a symlink and a matching Bun do not warn; no pinned Bun, no Mise, no `bun` on `PATH` and a failing probe stay silent; a watch operation with two watches warns once and still starts them. Verify with `mise x -- bun test packages/variant-api/src/mise-bun.spec.ts`: the file fails.

- [ ] 2.2 Add `mise-bun.ts` beside `mise.ts` (expected version through `runMise` `ls --current --json bun`, `which bun`, walk of the command `PATH`, `--version` probes with a timeout) and call it from `prepareVariant` and the provision operation with the operation's `log`. Verify with the same `bun test` command: the file passes, and `mise x -- bun test packages/variant-api/src/operations` still passes.

## 3. Docs and changelog

- [ ] 3.1 Update `docs/guide/configuration.md` (state that `${worktree}` is the absolute worktree path) and `docs/guide/runtime.md` (a Bun on `PATH` section under the Mise environment: the warning and how to fix `PATH`), and add a Fixed bullet and an Added bullet under `## Unreleased` in `CHANGELOG.md`. Verify each file says that and the changelog keeps `## Unreleased` above its newest version heading.

## 4. Verification

- [ ] 4.1 Run `mise x -- task lint`, `mise x -- task test`, `mise x -- task build`, `mise x -- openspec validate --all --strict --no-interactive` and `mise x -- openspec doctor --json`; all pass. Because the `variant` command changes, run `mise x -- task bleed:cli` and show in chat the command and output of the bled binary warning about a foreign Bun first on `PATH`.
