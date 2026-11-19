## 1. Implode of a vanished worktree

- [ ] 1.1 Extend `packages/variant-api/src/operations/implode.spec.ts` with failing assertions for [specs/variant-api/implode | Implode of a vanished worktree writes nothing there](../../specs/variant-api/implode/spec.md#requirement-implode-of-a-vanished-worktree-writes-nothing-there): after deleting the worktree directory, `implode` leaves the path missing (also `.cache/variant/`), still drops the database target and prunes, and with `branchRm: "no"` keeps the branch. Verify with `mise x -- bun test packages/variant-api/src/operations/implode.spec.ts`: the new assertions fail where something recreates the path.

- [ ] 1.2 Make `implodeVariant` and the helpers it calls (`teardownVariant`, `prepareRun`, runtime-state, state) write nothing under a missing worktree. Verify with the same `bun test` command: the file passes.

## 2. Relay watches its worktree

- [ ] 2.1 Extend `packages/variant-api/src/operations/watch.spec.ts` (and `watch-relay.spec.ts` for the relay unit) with failing assertions for [specs/variant-api/runtime | Detached watch follows its worktree](../../specs/variant-api/runtime/spec.md#requirement-detached-watch-follows-its-worktree). Cover each scenario: removal ends the processes, drops the target and ends the relay; a line printed while stopping writes no file; `variant implode` of the running detached watch; a branch with unmerged commits survives; a recreated directory still counts as gone; slug `main` only stops; `checkoutPollSeconds: 0`; an intact directory is left alone. Verify with `mise x -- bun test packages/variant-api/src/operations/watch.spec.ts packages/variant-api/src/watch-relay.spec.ts`: the new assertions fail.

- [ ] 2.2 Add the optional `cleanup` object to `RelayPlan`, filled by `watchVariant` for a detached watch with `supervise.checkoutPollSeconds`, the slug, the surviving working directory and the worktree. Verify a plan without it still behaves as before (existing relay specs stay green).

- [ ] 2.3 In `watch-relay.ts` record the worktree inode at start, tick on an `unref`ed timer, and on gone: set the writers' `gone` flag (log queue dropped, `in.sock` untouched, relayed lines discarded), stop the watch process trees by their own pids, and unless the slug is `main` lazily import and call `implodeVariant` with `branchRm: "no"`, then end the relay. Verify with the `bun test` command of 2.1: the file passes.

- [ ] 2.4 Extend `packages/variant-vscode/src/watch-relay-bundle.spec.ts` with a failing case that the bundled `watch-relay.js` cleans up when its worktree is removed, then pass it by checking the dynamic import is bundled. Verify with `mise x -- bun test packages/variant-vscode/src/watch-relay-bundle.spec.ts`.

## 3. Docs and changelog

- [ ] 3.1 Update the `supervise.checkoutPollSeconds` description in `packages/variant-config/variants.example.yaml` and the schema source in `packages/variant-config/src/schema.ts` (it also covers a detached watch), the runtime and `watch` sections of `docs/guide/`, and add a Fixed bullet under `## Unreleased` in `CHANGELOG.md`. Verify each file says that, and that `mise x -- bun test scripts packages/variant-config` passes.

## 4. Verification

- [ ] 4.1 Run `mise x -- task lint`, `mise x -- task test`, `mise x -- task build`, `mise x -- openspec validate --all --strict --no-interactive` and `mise x -- openspec doctor --json`; all pass.

- [ ] 4.2 Because the `variant` command changes, run `mise x -- task bleed:cli` and show in chat the command and output of the bled binary: start a detached watch in a scratch variant, delete its worktree, and show that the processes end and the path stays missing.
