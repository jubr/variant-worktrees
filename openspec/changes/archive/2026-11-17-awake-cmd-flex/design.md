## Context

See proposal.md for why. The controller in `chat-renamer-api/src/awake.ts` already splits `awake.cmd` into argv and substitutes the host pid, then compares it with the one allowed argv (`isOneCommand`, `runnable`, `wantsRun`). Everything else is dropped: `update` takes the "mode changed" branch and kills without starting. A failed start is a synchronous `catch` that logs at error every time. `spawnCaffeinate` in `chat-renamer-vscode/src/awake-watch.ts` wraps `node:child_process` `spawn` and attaches no `error` listener. For a missing program Node reports that asynchronously, so a custom command that does not exist would surface as an unhandled `error` event instead of a failed start.

## Goals / Non-Goals

**Goals:**

- Any non-blank `awake.cmd` is tried.
- One warn line per distinct failing command, and no restart storm for a command that fails fast.

**Non-Goals:**

- A shell, quoting, or an argv array setting. The split stays "whitespace, no shell".
- Reaping a custom command's child when the host is killed without dispose. Only the default command's `-w` guarantees that.

## Decisions

### The gate becomes "default command needs `caffeinate`"

`runnable(cmd)` becomes: the argv is non-empty, and when it equals the default argv the startup binary check must have passed. The "other command" branch in `update` goes away, so a changed command goes through `ensure`, which already kills the tracked process and starts `pendingArgs` once it has exited. The kill reason stays `mode changed`, so the log vocabulary does not change.

Alternative: gate every command on the `caffeinate` check. Rejected: that makes a custom command on Linux or Windows unusable for an unrelated reason.

### A failed start is a synchronous throw, an `error` event, or an exit within 1 second

`AwakeProcess` gains `once("error", listener)`. `spawnCaffeinate` forwards the child's `error` event. The controller marks the child as failed when `error` fires, or when `exit` fires within 1 second of the start (injected `now`) while no stop was requested. A failed child is untracked and not replaced at once. The existing "unexpected exit, replace" path applies only after 1 second. The next `update` with activity and no tracked process starts it again, which is the existing retry rule. The poll calls `update` every 5 seconds while active, so a failing command is retried at that rate, not in a loop.

Alternative: treat only a spawn error as failed. Rejected: `awake.cmd` such as `sh -c "exit 1"` or a wrapper that prints "not found" and exits would restart in a tight loop through the unexpected-exit path.
Alternative: exponential backoff. Rejected for now: the poll interval is already a floor, and backoff adds state the spec does not need.

### One warn per distinct command

The controller keeps a `Set<string>` of the joined, substituted argv that has been warned about. The first failure for a command writes `awake.warn("start failed", { command, reason })`. Later failures of that command log at trace. The set lives as long as the controller, so `awake.cmd` going back to a command that already failed does not warn again, and a different failing command warns once for itself. The existing process-exit-while-active warn (`exit`) is unchanged and is a different line.

This replaces the error-level `start failed` line, including for the default command. A missing default binary is already covered by the startup `caffeinate unavailable` info line, so the error level added little.

Alternative: warn once per controller. Rejected: a second, different broken command would be silent.

### Startup probe: try the command once, right away

The availability info line is written in the controller constructor, before any settings reach it. The first `update` is the earliest point where `cmd`, `when`, and `owned` are known. On the first `update` with `owned` and `when === "chatsActive"` the controller calls `start(oneArgv)` with reason `probe`, unless the argv is the default and the `caffeinate` check failed. That keeps a spawn error or a fast exit directly behind the availability line: no turn has to happen first, and the one-time warn is already spent when a session later starts.

The probe is the tracked process, not a separate child. That keeps "one process per host" true and lets a session that starts inside the window adopt it. A 1-second timer (the injected `schedule`) kills it with reason `probe` when `wantsRun()` is false. `update` must not arm the grace delay for a probe child that no session has claimed, so an idle `update` does not keep it for 180 seconds. A flag on the tracked record is enough: it is cleared when a session becomes active and the child is adopted. The timer and the 1-second failure window are the same clock, so a command that exits inside the window is a failed start, not a probe that ended.

The probe runs once per controller. A later `cmd` or `when` change does not probe again. Retrying is the existing behaviour on the next session.

Alternative: check that the program exists (`access`, PATH lookup) without spawning. Rejected: it does not match the way a spawn fails, and it never exercises the arguments.
Alternative: leave the probe running until the grace delay. Rejected: it would hold the machine awake with no chat, contrary to the spec's "SHALL NOT keep it awake otherwise".
Alternative: probe on every `awake.cmd` change. Not taken: the request is startup. The cost is that a command changed while idle shows its failure at the next turn.

### The start line quotes what ran

`awake.debug('+ "<argv joined>"', ...)` already quotes the argv, so the default line is unchanged and a custom command shows its own text.

## Risks / Trade-offs

- [A custom command without `-w ${extensionHostPid}` outlives a killed host] → Documented in the setting description, the docs, and the README. Idle, `never`, dispose, and loss of ownership still kill it.
- [A command that forks and exits at once, such as a daemonizing launcher, looks failed] → It warns once and is retried every poll. Documented: the command must stay in the foreground.
- [Whitespace split breaks a path with spaces] → Unchanged from today. Out of scope.
- [The 1-second window misreads a slow-to-fail command as healthy] → It then takes the unexpected-exit path and is replaced once per exit. Accepted.

- [The probe holds the machine awake for up to 1 second at startup] → Accepted. It is the same `caffeinate` assertion, and a probe that no session claims is killed at once after the window.
- [A probe of a custom command has side effects of its own] → It is the command the user configured, run once for at most 1 second per owner. Documented.

## Migration Plan

No stored state. A user who set a non-default `awake.cmd` while it was ignored will start seeing that command run after the update. Rollback is the previous build.
