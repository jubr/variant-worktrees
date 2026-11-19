## Why

A detached `watch` outlives the command that started it. When its worktree is removed (`variant implode`, or a plain `rm -rf`), the relay that captures the watch output keeps running its watch processes and keeps writing under a directory that no longer exists. Those writes can recreate `.cache/variant/` and its files, so an imploded variant leaves debris behind and its processes keep running.

## What Changes

- **The relay watches its worktree.** The detached watch relay checks every `supervise.checkoutPollSeconds` (default 5, `0` turns it off) that the worktree it was started for is still there. The attached watch already checks this; the relay reuses the same setting.
- **A vanished worktree ends the watch.** When the worktree directory is gone, the relay stops every watch process with its descendants and implodes the variant. The implode must work when the directory is already gone.
- **Nothing is written meanwhile.** From the moment the relay sees the worktree is gone, it writes no file under that directory: no `watch.log` line, no `in.sock`, no state or runtime file, no log directory. An implode of a missing worktree writes nothing under it either.
- **No data loss.** The cleanup implode keeps the local branch. The relay never deletes work that a plain directory removal left on a branch.

## Capabilities

### New Capabilities

### Modified Capabilities

- `variant-api/runtime`: a detached watch relay stops the watches and implodes the variant when its worktree directory disappears, and writes nothing under that directory afterwards.
- `variant-api/implode`: imploding a variant whose worktree directory is already gone writes nothing under that directory.

## Impact

- `packages/variant-api/src/watch-relay.ts` (relay plan, directory check, guarded log), `operations/watch.ts` (plan carries slug and the surviving working directory), `operations/implode.ts` and the runtime-state helpers it calls.
- `docs/guide/` runtime/commands pages, the `supervise.checkoutPollSeconds` description (`variants.example.yaml`, schema comment) and `CHANGELOG.md`.
- No change to attached `watch`, to the CLI flags, or to the MCP tools.

## Non-goals

- A new setting: the existing `supervise.checkoutPollSeconds` governs the check.
- Cleaning up a variant whose relay is not running (a watch that was stopped, or a machine that restarted).
- Changing what an attached `watch` does when its worktree disappears.
