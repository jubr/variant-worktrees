## Why

The release PR run of `check:full` stalled for 22 minutes (normally 2.5): 35 `variant-api` watch tests timed out one after another, then `src/db/postgres.spec.ts` never finished, and the job had no time limit. The same commit passed on a rerun. A look at this host shows the other half of the problem: 64 `bun ../watch.js` processes (parent `launchd`, some 6 days old) from `watch.spec.ts`, each holding only its working directory `/private/tmp/variant-watch-*/fe`. The tests track the pid of one watch per test and never kill the others, and nothing kills a watch of a test that timed out.

## What Changes

- Every process a package test starts is stopped when that test ends, including a test that timed out or threw: the `watch.spec.ts` harness finds the processes of its project directory itself instead of relying on each test to record pids, then removes the directory.
- A test that waits has a wait shorter than its own timeout, so a slow runner fails one test with the condition that was not met instead of timing out every test after it.
- `variant-api` tests get an explicit test timeout through `bun test --timeout` in the package `test` script, one that fits a loaded CI runner (bun ignores a `[test] timeout` in `bunfig.toml`).
- The CI jobs get a `timeout-minutes`, so a hang fails in minutes.
- The orphaned `bun ../watch.js` processes and `variant-watch-*` directories already on this host are removed once, only those whose working directory is under `/tmp/variant-watch-*`.

## Capabilities

### New Capabilities

### Modified Capabilities

- `meta/local-checks`: a test run leaves no process behind.
- `meta/ci-feature-builds`: a hung gate fails within a bounded time.

## Impact

- `packages/variant-api/src/operations/watch.spec.ts` (harness and the tests that record a single pid), the `test` script of `packages/variant-api/package.json`, other specs that spawn processes if the audit finds the same pattern. Everything about `watch-relay` (its code and its specs) is fixed in another change and is out of scope here.
- `.github/workflows/ci-branch.yaml` (`timeout-minutes` on both jobs).
- No product code, no new dependency, no documentation or changelog entry (test and CI only).

Non-goals: changing watch supervision itself, and a task that reaps orphans on a schedule.
