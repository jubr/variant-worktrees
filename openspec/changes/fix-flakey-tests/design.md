## Context

See proposal.md, Why. Findings so far:

- `watch.spec.ts` starts `bun ../watch.js` per watch (own process group, parent reparented to `launchd` when the test run ends). `killAtEnd` is filled by hand, mostly with the pid of `be` only. Running the file leaks exactly one `fe` per run; running each `describe` alone shows the leak is in `watch supervision`, where the tests that leave the set running record `be` and not `fe`.
- `bun test` kills "dangling processes" of a test that timed out, but not their process groups, and the abandoned test body keeps running against the shared `process.env.PATH`, the engine stub and the ports, which the next test's setup then changes. This explains why one slow test is followed by 34 more (35 `(fail)` lines in a row), and is the working hypothesis, not a reproduction.
- `until()` defaults to 10 s, `bun test` to 5 s, and several tests wait 3 s on top of a 1.5 s ready delay; on a loaded runner (hk runs the package tests concurrently) the sum passes 5 s and the test is cut off mid-flight instead of failing on its own condition.
- Nothing in the `postgres.spec.ts` hang is understood yet (it started after the mass kill of dangling processes and ran 18 min with the 5 s test timeout in force). A `bun test` that never returns is the reason for the job limit.
- The 64 orphans hold no files besides their working directory, a `bun` binary and unix stdio (`->(none)`); nothing else keeps them alive, they idle in `setInterval`.

## Goals / Non-Goals

**Goals:** no process outlives its test; a slow runner fails one test with a message; a hang ends the job.

**Non-Goals:** speeding up the watch tests, changing `watchVariant`, and cleaning orphans that are not test leftovers (a real `watch-relay.ts` of another variant is on this host and is not touched).

## Decisions

- **Harness cleanup by directory, not by pid.** `withProject` registers its directory in a list. `afterEach` reads every `started-*.txt` marker and the runtime state's `pid`s under each registered directory, sends `SIGKILL` to each process group (`-pid`), and removes the directory. The tests keep their own `killAtEnd` lines until a task removes the redundant ones. Alternative: make `watchVariant` return all pids to every test: more edits and does not cover a test that timed out before it returned.
- **Register before running.** The directory is registered right after `mkdtemp`, so a timed-out test is cleaned in `afterEach` even though its `finally` has not run.
- **Waits are shorter than the timeout.** `bunfig.toml` in `packages/variant-api` sets `[test] timeout = 30000`; `until` defaults to 10 s, below it, and the 3 s waits stay below too. Alternative: raise only the slow tests with a third argument to `it`; rejected because the budget would be spread over 71 tests.
- **Job limit.** `timeout-minutes: 20` on both jobs (normal 2.5 min, observed worst 3 min).
- **One-time host cleanup is a command, not code.** Select pids whose `cwd` (from `lsof -a -d cwd`) matches `/private/tmp/variant-watch-*`, show the list, `kill` them, then remove the `variant-watch-*` directories that no process uses. No script is added to the repository.

## Risks / Trade-offs

- [The loaded-runner hypothesis is wrong] → first task reproduces under load (CPU burners next to `bun test`); if the cascade does not reproduce, keep the cleanup and the limits and record what was seen in the task.
- [`SIGKILL` of a group hides a product bug where `down` leaves a process] → tests that assert a process is gone (`isProcessAlive(be)`) keep asserting before `afterEach` runs.
- [Killing orphans by directory name kills a real watch] → only the `variant-watch-*` directory of the tests is matched; a real variant lives under `_v-*`.
