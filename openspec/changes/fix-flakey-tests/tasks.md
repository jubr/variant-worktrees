## 1. Reproduce

- [ ] 1.1 Run `bun test src/operations/watch.spec.ts` in `packages/variant-api` while one CPU burner per core runs, three times; record whether the timeout cascade and the `postgres.spec.ts` hang appear. Verify: the result (reproduced or not) is written under this task.
- [ ] 1.2 Add a failing check for [specs/meta/local-checks | A test run leaves no process behind](specs/meta/local-checks/spec.md): a spec in `packages/variant-api/src/operations/` that runs `watch supervision` style tests and asserts no `bun ../watch.js` with a `/tmp/variant-watch-*` working directory remains. Verify: it fails today with one leaked `fe`.

## 2. Cleanup in the harness

- [ ] 2.1 Register the project directory right after `mkdtemp` in `withProject`, and have `afterEach` kill the process group of every pid found in `started-*.txt` and the runtime state under registered directories, then remove them. Verify: the check from 1.2 passes and `bun test src/operations/watch.spec.ts` leaves the process count unchanged.
- [ ] 2.2 Remove the `killAtEnd` lines the harness now covers. Verify: the file passes and the process count is unchanged.
- [ ] 2.3 Audit `watch-relay-bundle.spec.ts`, `watch-warning.spec.ts` and every other spec that spawns (`rg "spawn|Bun.spawn|execFile"` in `packages/*/src/**/*.spec.ts`) for the same pattern; fix what leaks. Verify: `task test` leaves no new `bun`, `mise` or `script` process whose working directory is under `/tmp`.

## 3. Timeouts

- [ ] 3.1 Add `packages/variant-api/bunfig.toml` with `[test] timeout = 30000` and keep every `until` and fixed wait in the specs below it. Verify: a deliberately unmet `until` fails with `condition not met in time` and not with a test timeout, and the next test still passes.
- [ ] 3.2 Add `timeout-minutes: 20` to both jobs of `.github/workflows/ci-branch.yaml` ([specs/meta/ci-feature-builds | A hung gate fails](specs/meta/ci-feature-builds/spec.md)). Verify: `mise x -- task lint:workflows` passes.

## 4. This host

- [ ] 4.1 List processes whose working directory matches `/private/tmp/variant-watch-*` (`lsof -a -d cwd`), show the list in chat, kill them, remove the directories no process uses. Verify: `pgrep -f "bun ../watch.js"` finds none and `ls -d /private/tmp/variant-watch-*` finds none.

## 5. Verification

- [ ] 5.1 Run `mise x -- task lint`, `mise x -- task test`, `mise x -- task build`, `mise x -- openspec validate --all --strict --no-interactive` and `mise x -- openspec doctor --json`; all pass, and `pgrep -f "bun ../watch.js"` is still empty afterwards.
