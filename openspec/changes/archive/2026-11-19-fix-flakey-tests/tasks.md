## 1. Reproduce

- [x] 1.1 Run `bun test src/operations/watch.spec.ts` in `packages/variant-api` while one CPU burner per core runs, three times; record whether the timeout cascade and the `postgres.spec.ts` hang appear. Verify: the result (reproduced or not) is written under this task.
  Result: not reproduced. 71 of 71 passed with 28 busy loops (2 per core, 14 cores; 36 s and 41 s instead of 31 s) and with 50 busy loops (43 s), so the cascade and the `postgres.spec.ts` hang stay unexplained. The leak was reproduced: one `fe` left behind per run. The cleanup, the wait limits and the job limit below do not depend on the cause.
- [x] 1.2 Add failing checks for [specs/meta/local-checks | A test run leaves no process behind](specs/meta/local-checks/spec.md): a spec for the project cleanup helper (`src/test/stop-project-processes.spec.ts`), and an `afterAll` in `watch.spec.ts` that fails when a pid any test project started is still alive. Verify: both fail today (the helper stops nothing; the `afterAll` names the leaked `fe` and other pids).

## 2. Cleanup in the harness

- [x] 2.1 Register the project directory right after `mkdtemp` in `withProject`, and have `afterEach` and the `finally` of `withProject` kill the process group of every pid found in `started-*.txt` and the runtime state under registered directories (never the test run itself or its parent), then remove them. Verify: the checks from 1.2 pass and `bun test src/operations/watch.spec.ts` leaves the process count unchanged (75 before, 75 after).
- [x] 2.2 Remove the `killAtEnd` lines the harness now covers. Verify: the file passes and the process count is unchanged. The two lines that record pids known without a marker stay.
- [x] 2.3 Audit the other specs that spawn (`rg "spawn|Bun.spawn|execFile"` in `packages/*/src/**/*.spec.ts`), leaving `watch-relay` and its specs alone (fixed in another chat), for the same pattern; fix what leaks. Verify: `task test` leaves no new `bun`, `mise` or `script` process whose working directory is under `/tmp`. Result: a full `task test` left no new process with parent 1; no other spec needed a fix.

- [x] 2.4 CI run 44535857420 of this branch failed `watch supervision > stops the watches and returns when the terminal sends 3` with exit code 1 instead of 0 (not reproduced locally, 25 runs under load). Working explanation: the test ends its input with `input.end("3\\n")`; when that arrives less than 20 ms after the supervision armed its key reader, the closed reader is treated as the end of input and `watch` returns the exit code of the dying watches (1). Send the key with `input.write` like the other terminal tests, in the four tests that used `input.end`. Verify: `watch.spec.ts` passes and CI is green. The 20 ms rule is product code (`watch.ts`) and stays as it is.

## 3. Timeouts

- [x] 3.1 Run the `variant-api` tests with `bun test --timeout 30000` (package `test` script) and keep every `until` and fixed wait in the specs below it. Verify: a deliberately unmet `until` fails with `<condition> not met in time` and not with a test timeout, and the next test still passes. (`bunfig.toml` has no test timeout key in bun 1.4.2: a 6 s test still failed at 5 s with it, and passed with `--timeout 30000`.)
- [x] 3.2 Add `timeout-minutes` (20 for the gate, 15 for the Node smoke test) to both jobs of `.github/workflows/ci-branch.yaml` ([specs/meta/ci-feature-builds | A hung gate fails](specs/meta/ci-feature-builds/spec.md)). Verify: `scripts/ci-feature-builds.spec.ts` fails without them and passes with them, and `mise x -- task lint:workflows` passes.

## 3b. Split the slow tests

- [x] 3b.1 Add failing checks for [specs/meta/local-checks | Slow package tests run as their own step](specs/meta/local-checks/spec.md): `scripts/hk-config.spec.ts` (the `ci` plan has `test-slow` for exactly the packages with a `test:slow` script, the default plan none, `test:scripts` and `docs:build` wait for them) and a script spec that every `test:slow` file exists and each test file runs in exactly one of `test` and `test:slow`. Verify: both fail while no package has the script.
- [x] 3b.2 Split `variant-api` (about 121 of 234 s: `mise-bun`, `operations/watch`, `operations/implode`, `mise-install`, `operations/init`) and `variant-cli` (`completions-shells`, about 91 of 141 s) with `--path-ignore-patterns` in `test` and the files in `test:slow`; add the `test-slow` step to their `hk.pkl`, the dependency in the root `hk.pkl` and `task test`. Verify: the checks from 3b.1 pass, `hk check --all --profile ci --plan` lists the four steps, and a run of both steps of a package passes the same number of tests as before (581 and 292) in about half the time.
- [x] 3b.3 Mention the step in `CONTRIBUTING.md`. Verify: it names `test-slow` and how to list a file.

## 4. This host

- [x] 4.1 List processes whose working directory matches `/private/tmp/variant-watch-*` (`lsof -a -d cwd`), show the list in chat, kill them, remove the directories no process uses. Verify: `pgrep -f "bun ../watch.js"` finds none and `ls -d /private/tmp/variant-watch-*` finds none.

## 5. Verification

- [x] 5.1 Run `mise x -- task lint`, `mise x -- task test`, `mise x -- task build`, `mise x -- openspec validate --all --strict --no-interactive` and `mise x -- openspec doctor --json`; all pass, and `pgrep -f "bun ../watch.js"` is still empty afterwards.
