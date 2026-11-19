## Context

`watch --detach` starts a relay process (`watch-relay.ts`, `runWatchRelay`). It reads one JSON plan from stdin, calls `launchWatches`, and keeps running until every watch process has exited. While it runs it owns the `watch.log` stream (opened once, `openLog`) and the stdin socket `.cache/variant/in.sock`. It knows only the plan: launches, delay, log path, flags, Mise path. Its standard error is `ignore`d.

The attached `watch` detects a vanished worktree in `untilEnd` (`operations/watch.ts`, every `supervise.checkoutPollSeconds`). Its `checkout` outcome then calls `closeLog()`, `adapter.destroy(slug)` and `clearVariantRuntime(...)`, which can write under the dead path and leaves state, containers and the worktree record behind. The detached relay has no equivalent, no slug, and no knowledge of the project beyond the log path.

`implodeVariant` already handles an absent worktree (`present` is false: `teardownVariant` runs without a worktree, `git worktree prune` runs, the branch is removed). What is missing is one shared cleanup that both paths call, and a guarantee that nothing is written under the dead path.

The CLI forwards every log event to the editor over the project socket, except steps `ipc` and `cli` (`localOnly` in `variant-cli/src/ipc-vscode.ts`). That socket lives under the project directory, so it must not carry these events.

## Goals / Non-Goals

**Goals:**

- A watch whose worktree is gone stops its processes and cleans the variant, with no operator action, attached or detached.
- No file or directory appears under the vanished path because of the watch, its captured output, or the cleanup implode.
- The cleanup says what it does, at `warn`, including every removal, without using the editor socket.

**Non-Goals:**

- Stopping what the watch processes themselves create in their own working directory. Variant cannot control a program's writes; stopping the process quickly is the remedy.
- A new setting or a new command.

## Decisions

### Reuse the timer and the setting

No natural event exists for "directory removed": the relay's only events are process exit and captured lines, and a quiet watch emits no lines. Platform directory watchers (`fs.watch`) report removal inconsistently across macOS, Linux and network volumes. So the relay runs a timer at `supervise.checkoutPollSeconds` (default 5, 0 off), the interval the attached watch already uses, inside the 5-second to 1-minute window asked for. The attached path keeps its existing timer in `untilEnd`; both use one shared `worktreeIdentity` helper. The relay's timer is `unref`ed so it never keeps the relay alive.

Alternative: check on every captured line. Rejected: silent watches would never trigger, and a statistic per line costs for nothing. A line-triggered check may still be added later as an extra latch.

### "Gone" means not the same directory

At start the watch records the device and inode of the worktree directory (`worktreeIdentity`). At each tick the worktree is gone when `stat` fails or reports another identity. A running watch process that writes `node_modules/.vite` or `.cache/` after the removal recreates parts of the path, and a plain `existsSync` would then say "present" forever. The inode does not survive that. The attached `untilEnd` switches from `existsSync` to the same helper.

Alternative: `existsSync` on the worktree and on `.git`. Rejected: both can be recreated by a stray process; the inode cannot.

### One cleanup, two callers

A new module `watch-cleanup.ts` exports `cleanupVanishedWorktree`. It takes the slug, the surviving working directory, the worktree path, the pids it holds, and a `silence` hook that makes the caller's writers drop everything. In order it:

1. Calls `silence` (log queue dropped, `in.sock` untouched, relayed lines discarded). An open `createWriteStream` handle writes to the unlinked inode and cannot recreate the path, but a failed or late reopen could; the explicit flag removes that dependence.
2. Announces and stops each watch process tree with `stopProcessTree` on the pids it holds. It does not read `state.yaml`, because that file is gone.
3. Unless the slug is `main`, calls `implodeVariant` with `branchRm: "no"` and an `announce` option (see below), then returns.

The detached relay calls it, loaded with a dynamic `import()` so a healthy relay does not pay for the client, then ends. The attached `watchVariant` calls it in the `checkout` branch instead of `adapter.destroy` + `clearVariantRuntime`, and still returns exit code 1.

Alternative: the relay runs `variant implode` as a child process. Rejected: the relay cannot assume a `variant` binary, and the compiled executable and the extension bundle would need different paths.

### The plan carries what cleanup needs

`RelayPlan` gains an optional `cleanup` object: `slug`, `cwd` (the directory the operation context is built from: the primary checkout or the variant root, never the vanished worktree), `worktree`, and `pollSeconds`. `watchVariant` fills it only for a detached watch. A plan without it behaves as today, so existing callers and an already-built relay file stay compatible.

### Announcements: warn, step `watch-cleanup`, never on the socket

`implodeVariant` gets an optional `announce(message)` in `ImplodeOptions`, called before each removing action: container removal, target drop, state-file removal (absolute path), `git worktree prune`, branch kept or removed. It is not exposed as a CLI flag or MCP argument, because those derive from `commands.ts`. The cleanup module wraps both its own steps and `announce` into one emitter: `log(levelForDirectory(LogLevel.warn, cwd), message, { slug, step: "watch-cleanup" })`. Going through `levelForDirectory` keeps the logging capability's rule that events for a known temporary directory are `trace`; tests that need `warn` pass a project directory that is not temporary.

Delivery:

- Attached: the CLI sink prints it to stderr at threshold `warn`. `localOnly` in `ipc-vscode.ts` gains the step `watch-cleanup`, so the socket never receives it.
- Detached: the relay is its own process with no sink. It installs a minimal stderr sink for the cleanup (`[warn] message`), and `startDetachedRelay` passes `stderr: "inherit"` instead of `"ignore"`, so the lines reach the terminal or output channel that started the watch. No file is involved; a file under the worktree is forbidden and a file elsewhere has no natural home.

Alternative: write the warnings to a cache file outside the worktree. Rejected: nobody reads it, and it invents a location. Alternative: send them over the socket. Rejected by the request, and the socket path lies under the vanished directory.

### Implode of a missing worktree must not recreate it

`teardownVariant` is called with `worktree` undefined, so `removeVariantRuntime` and the storage removal are skipped. The remaining risks are `prepareRun` and `levelForDirectory(... directory)` taking the context directory, and any helper that calls `mkdirSync` on a path under the old worktree (`writeVariantRuntime`, the log helpers). Tests assert that the path does not exist after the call and fix whatever recreates it.

### Keep the branch

The implode runs with `branchRm: "no"`. When the user ran `variant implode`, the branch was handled by that command. When the directory was deleted by hand, the commits on its branch may be the only copy; the watch must not remove them. The merge gate cannot protect them because `implode` skips it when the worktree is absent. The announcement still names the branch it keeps.

Alternative: default `branchRm` (delete). Rejected: it turns a directory removal into silent data loss.

## Risks / Trade-offs

- [The relay is a separate bundle (`watch-relay.js`, the compiled executable, the extension); the lazy import inflates it] → The bundle spec asserts the relay starts and cleans up from the bundled file.
- [Inherited stderr of a relay that outlives its parent can print into an unrelated terminal later] → Accepted: the event is rare and the lines are exactly what the user would want to see; `2>/dev/null` at the start silences it.
- [The context rebuilt in the relay differs from the caller's (environment, Mise)] → The relay receives `cwd` and inherits the caller's environment (as for the watches); the implode only needs configuration and the database target.
- [Two cleanups race: `variant implode` is still running while the watch ticks] → `implodeVariant` is idempotent for a missing worktree; a second run reports nothing removed.
- [A removal that only briefly makes the directory unavailable, such as an unmounted volume, counts as gone] → Accepted; the attached watch already behaved this way, and 0 turns the check off.
- [Up to `checkoutPollSeconds` of lag between removal and cleanup] → Writes are harmless in that window (the open stream targets the removed inode), and the interval is configurable.

## Migration Plan

Ship with the next release. Relays started before the upgrade keep running without the check until they end. No state or configuration migration; rollback is reverting the change.
