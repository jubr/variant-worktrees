## Context

`watch --detach` starts a relay process (`watch-relay.ts`, `runWatchRelay`). It reads one JSON plan from stdin, calls `launchWatches`, and keeps running until every watch process has exited. While it runs it owns three kinds of output under the worktree: the `watch.log` stream (opened once, `openLog`), the stdin socket `.cache/variant/in.sock`, and nothing else of its own. It knows only the plan: launches, delay, log path, flags, Mise path.

The attached `watch` already detects a vanished worktree (`untilEnd` in `operations/watch.ts`, every `supervise.checkoutPollSeconds`). The detached relay has no equivalent, no slug, and no knowledge of the project beyond the log path. `implodeVariant` already handles an absent worktree (`present` is false: `teardownVariant` runs without a worktree, `git worktree prune` runs, the branch is removed), so the missing piece is who calls it and how to keep every write away from the dead path.

## Goals / Non-Goals

**Goals:**

- A relay whose worktree is gone stops its processes and cleans the variant, with no operator action.
- No file or directory appears under the vanished path because of the relay, its watch processes' captured output, or the cleanup implode.

**Non-Goals:**

- Stopping what the watch processes themselves create in their own working directory. Variant cannot control a program's writes; stopping the process quickly is the remedy.
- A new setting or a new command.

## Decisions

### Reuse the timer and the setting

No natural event exists for "directory removed": the relay's only events are process exit and captured lines, and a quiet watch emits no lines. Platform directory watchers (`fs.watch`) report removal inconsistently across macOS, Linux and network volumes. So the relay runs a timer at `supervise.checkoutPollSeconds` (default 5, 0 off). This is the interval the attached watch uses already, inside the 5-second to 1-minute window asked for, and one setting describes both. The timer is `unref`ed so it never keeps the relay alive.

Alternative: check on every captured line. Rejected: silent watches would never trigger, and a statistic per line costs for nothing. A line-triggered check may still be added later as an extra latch.

### "Gone" means not the same directory

At start the relay records the device and inode of the worktree directory. At each tick the worktree is gone when `stat` fails or reports another inode. A running watch process that writes `node_modules/.vite` or `.cache/` after the removal recreates parts of the path, and a plain `existsSync` would then say "present" forever. The inode does not survive that.

Alternative: `existsSync` on the worktree and on `.git`. Rejected: both can be recreated by a stray process; the inode cannot.

### The plan carries what cleanup needs

`RelayPlan` gains an optional `cleanup` object: `slug`, `cwd` (the directory the operation context is built from: the primary checkout or the variant root, never the vanished worktree), `worktree`, and `pollSeconds`. `watchVariant` fills it only for a detached watch. A plan without it behaves as today, so existing callers and the already-published relay file stay compatible.

### Close the writers first, then stop, then implode

On "gone" the relay, in order:

1. Sets a `gone` flag that every writer checks: `openLog` drops queued and later lines (it ends its stream without flushing), the stdin socket server is closed and its path is not touched (`rmSync` of a missing path is harmless, but nothing is created), and `relay()` lines are discarded.
2. Stops each watch process tree with `stopProcessTree` on the pids it holds itself. It does not read `state.yaml` to find them, because that file is gone.
3. Unless the slug is `main`, calls `implodeVariant` with `branchRm: "no"` in-process (loaded with a dynamic `import()`, so a healthy relay does not pay for the client), then ends.

An open `createWriteStream` handle writes to the unlinked inode and cannot recreate the path, but a failed or late reopen (for example on a stream error) could. The flag makes the guarantee explicit instead of relying on that.

### Implode of a missing worktree must not recreate it

`teardownVariant` is called with `worktree` undefined, so `removeVariantRuntime` and the storage removal are skipped. The remaining risks are `prepareRun` and `levelForDirectory(... directory)` taking the context directory for the log, and any helper that calls `mkdirSync` on a path under the old worktree. Tests assert that the path does not exist after the call and fix whatever recreates it.

### Keep the branch

The implode runs with `branchRm: "no"`. When the user ran `variant implode`, the branch was handled by that command. When the directory was deleted by hand, the commits on its branch may be the only copy; the relay must not remove them. The merge gate cannot protect them because `implode` skips it when the worktree is absent.

Alternative: default `branchRm` (delete). Rejected: it turns a directory removal into silent data loss.

## Risks / Trade-offs

- [The relay is a separate bundle (`watch-relay.js`, the compiled executable, the extension); an `implodeVariant` import inflates it] → The import is lazy and the bundle spec asserts the relay still starts and cleans up from the bundled file.
- [The context rebuilt in the relay differs from the caller's (environment, Mise)] → The relay receives `cwd` and inherits the caller's environment (as it does for the watches); the implode only needs configuration and the database target.
- [Two cleanups race: `variant implode` is still running while the relay ticks] → `implodeVariant` is already idempotent for a missing worktree; a second run reports nothing removed.
- [A removal that only briefly makes the directory unavailable, such as an unmounted volume, counts as gone] → Accepted; the attached watch behaves the same, and 0 turns the check off.
- [Up to `checkoutPollSeconds` of lag between removal and cleanup] → Writes are harmless in that window (the open stream targets the removed inode), and the interval is configurable.

## Migration Plan

Ship with the next release. Relays started before the upgrade keep running without the check until they end. No state or configuration migration; rollback is reverting the change.
