## 1. Implode of a vanished worktree

- [x] 1.1 Extend `packages/variant-api/src/operations/implode.spec.ts` with failing assertions for [specs/variant-api/implode | Implode of a vanished worktree writes nothing there](../../specs/variant-api/implode/spec.md#requirement-implode-of-a-vanished-worktree-writes-nothing-there): after deleting the worktree directory, `implode` leaves the path missing (also `.cache/variant/`), still drops the database target and prunes, with `branchRm: "no"` keeps the branch, and with `announce` set calls it before the drop, the state-file removal (absolute path), the prune and the branch decision. Verify with `mise x -- bun test packages/variant-api/src/operations/implode.spec.ts`: the new assertions fail.

- [x] 1.2 Make `implodeVariant` and the helpers it calls (`teardownVariant`, `prepareRun`, runtime-state, state) write nothing under a missing worktree, and add the optional `announce` to `ImplodeOptions` (not a CLI flag or MCP argument). Verify with the same `bun test` command: the file passes, and `packages/variant-cli` and `packages/variant-mcp` flag specs still pass.

## 2. Shared cleanup

- [x] 2.1 Create `packages/variant-api/src/watch-cleanup.spec.ts` with failing assertions for [specs/variant-api/runtime | Watch follows its worktree](../../specs/variant-api/runtime/spec.md#requirement-watch-follows-its-worktree): `worktreeIdentity` says gone for a missing and for a recreated directory; `cleanupVanishedWorktree` silences first, stops each pid, implodes with the branch kept, skips the implode for `main`; the first event is the one `warn` (the path is gone) and every later event is `debug` with step `watch-cleanup` and the slug before its action, naming `fe` with its pid, the removed state file, the target, `git worktree prune`; a failed implode is a `warn`; a temporary project directory gives `trace` throughout. Verify with `mise x -- bun test packages/variant-api/src/watch-cleanup.spec.ts`: the file fails.

- [x] 2.2 Add `watch-cleanup.ts` (`worktreeIdentity`, `cleanupVanishedWorktree`, the announcing emitter). Verify with the same command: the file passes.

## 3. Detached watch

- [x] 3.1 Extend `packages/variant-api/src/operations/watch.spec.ts` and `packages/variant-api/src/watch-relay.spec.ts` with failing assertions for the detached scenarios of the requirement: removal ends the processes, drops the target and ends the relay; a line printed while stopping writes no file; `variant implode` of the running detached watch; a branch with unmerged commits survives; a recreated directory still counts as gone; slug `main` only stops; `checkoutPollSeconds: 0`; an intact directory is left alone; the warnings land in the file that is the relay's standard error; a pipe is not inherited. Verify with `mise x -- bun test packages/variant-api/src/operations/watch.spec.ts packages/variant-api/src/watch-relay.spec.ts`: the new assertions fail.

- [x] 3.2 Add the optional `cleanup` object to `RelayPlan` (filled by `watchVariant` for a detached watch with the poll seconds, slug, surviving working directory and worktree), run the relay's `unref`ed timer, make `openLog`, the stdin socket and the relayed lines honor the silence hook, call `cleanupVanishedWorktree` through a dynamic import, install the relay's stderr sink, and in `startDetachedRelay` hand the caller's standard error to the relay when it is a terminal or a file (`relayStderrMode`), never a pipe. Verify with the `bun test` command of 3.1: both files pass and a plan without `cleanup` still behaves as before.

- [x] 3.3 Extend `packages/variant-vscode/src/watch-relay-bundle.spec.ts` with a failing case that the bundled `watch-relay.js` cleans up when its worktree is removed, then pass it by making sure the dynamic import is bundled. Verify with `mise x -- bun test packages/variant-vscode/src/watch-relay-bundle.spec.ts`.

## 4. Attached watch

- [x] 4.1 Extend `packages/variant-api/src/operations/watch.spec.ts` with failing assertions for the attached scenarios: deleting the worktree stops the processes, drops the target, ends with exit status 1, leaves the path missing, clears nothing under it, and logs the steps; `checkoutPollSeconds: 0` keeps it running. Verify with `mise x -- bun test packages/variant-api/src/operations/watch.spec.ts`: the new assertions fail.

- [x] 4.2 Switch `untilEnd` to `worktreeIdentity` and replace the `checkout` branch of `watchVariant` (`adapter.destroy`, `clearVariantRuntime`) with `cleanupVanishedWorktree`, keeping exit status 1. Verify with the same command: the file passes.

## 5. Docs and changelog

- [x] 5.1 Update the `supervise.checkoutPollSeconds` description in `packages/variant-config/variants.example.yaml` and the schema source in `packages/variant-config/src/schema.ts` (it covers every watch), the runtime and `watch` sections of `docs/guide/` (cleanup, the `watch-cleanup` log events, the kept branch, the inherited standard error of a detached watch), and add a Fixed bullet under `## Unreleased` in `CHANGELOG.md`. Verify each file says that, and that `mise x -- bun test scripts packages/variant-config` passes.

## 6. Verification

- [x] 6.1 Run `mise x -- task lint`, `mise x -- task test`, `mise x -- task build`, `mise x -- openspec validate --all --strict --no-interactive` and `mise x -- openspec doctor --json`; all pass.
