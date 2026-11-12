## Context

See [proposal.md](proposal.md) for why `script` is the wrong terminal allocator. Behavior is [specs/variant-api/runtime | Watch output terminal](specs/variant-api/runtime/spec.md).

`spawnOnTerminal` in `packages/variant-api/src/watch-relay.ts` starts `bash`, holds a pipe open with `tail -f /dev/null`, then execs `script`. Linux passes `-c`. macOS passes the command after the typescript file. The typescript file is `/dev/null`. `stty cols 10000 rows 200` runs before the watch command. A leading `^D` and two backspaces are stripped from the transcript. The recorded pid is that `bash`/`script` process. `stopProcessTree` signals the process group and walks descendants.

The same `launchWatches` runs in the CLI (Bun), in `bun test` (Bun), in the compiled `variant` executable (Bun), and in the editor relay. The editor relay is the editor executable with `ELECTRON_RUN_AS_NODE=1`, so it is Node. `variant-api` is built with `--target node`. `dist/index.js` and `dist/commands.js` must load on Node 22.13 without a Bun-only import, and the existing source scan rejects a `Bun.` token in those two files. `dist/watch-relay.js` is a separate build entry. The extension bundles that relay and starts it with `process.execPath`.

util-linux `script.c` does not own the terminal. `lib/pty-session.c` does: `openpty`, `setsid`, `TIOCSCTTY`, dup the slave onto stdin, stdout, and stderr, then copy the master. Bun 1.4, the runtime pinned in `mise.toml`, does that session in `Bun.Terminal`: `openpty` on Linux and macOS, ConPTY on Windows. `cols` and `rows` set the window size. Leaving the terminal open keeps the slave's stdin open. Child output arrives on the `data` callback. `proc.stdout` is null when `terminal` is set.

## Goals / Non-Goals

**Goals:**

- One allocator for the existing terminal contract, with no `script`, `stty`, or `tail` hold.
- In-process on Bun, including the compiled executable.
- The same allocator from Node, by executing `bun`, so the editor relay keeps working.
- `down` still stops the watch command.

**Non-Goals:**

- See proposal.md. In particular, no TypeScript `openpty`, no native pty addon, and no `script` fallback.

## Decisions

**Use `Bun.Terminal`, not a port of `script.c` and not `node-pty`.** The session this watch needs is the one `pty-session.c` already implements, and Bun 1.4 already exposes it. A TypeScript port would still have to call `openpty` or `CreatePseudoConsole`. Node cannot. `node-pty` is a native addon: its prebuilds do not match the editor's Electron ABI, `vsce package --no-dependencies` would not ship it, and `bun build --compile` would have to carry a `.node` file. Rejected.

**Call the runtime through `globalThis["Bun"]` inside the tty start, never at load, and never via `bun:`.** A static `Bun.` token fails the Node bundle scan even when the function never runs. A missing global means this process cannot allocate a terminal. No-tty spawn stays `node:child_process`.

**On Bun, spawn the watch command on that terminal in process.** Command stays a shell string: `sh -c` of `launch.command`, with `colorTerm` applied to the environment. Window size is `cols: 10000`, `rows: 200`, so the `stty` wrapper goes away. Do not write to the terminal and do not close it while the child runs, so stdin does not end and nothing emits `^D`. The `data` callback is the transcript and is what the existing line relay reads as stdout. Stderr is not a second stream. Drop `withoutScriptEof`. The recorded pid is the shell Bun spawned. Hold the terminal object so it is not collected.

**On Node, run that same function under `bun`.** Resolve the executable from `PATH` first. When `PATH` has no `bun`, run `which bun` through `miseBinaryFor(context.config, context.miseBinPath)` when that returns a binary. Pass the absolute path in the relay plan so the editor relay, which is Node, does not look Mise up a second time with a smaller environment. Spawn `bun` on `relayModulePath()` with `--internal-pty` and the launch JSON on stdin. That child is Bun, takes the in-process path, and writes raw terminal bytes to its stdout. The parent records the `bun` pid, with `detached: true` so `stopProcessTree` can signal the group, and relays that stdout. `bun` not resolved throws the existing start error for that watch key and includes that Bun was not found. No process is left behind.

`--internal-pty` is handled before the watch-relay entry. It is not `--internal-watch-relay`. The compiled executable never takes this hop: the process is already Bun.

**The Node bundle scan stays.** The implementation must not put the token `Bun.` into `dist/index.js` or `dist/commands.js`. The Node import test stays the load-time proof.

## Risks / Trade-offs

- [Bun rejects a 10000-column window] → Request 10000. If the runtime refuses it, use the largest accepted size that is still at least 1000 and point the column assertion at that size.
- [`Bun.spawn` does not make the child a process-group leader] → `down` still walks descendants from the recorded pid. The terminal test covers `down`. Add a group only if that test shows a survivor.
- [Editor host has no `bun` on `PATH` and Mise cannot see one] → The tty watch fails with the watch name. That replaces "script is missing", including on Windows, where `script` never existed. A host with Mise-installed Bun keeps working.
- [Node without Bun, with `script`] → **BREAKING.** Those hosts lose tty. The changelog says so.
- [Helper stderr looks like watch output] → The `--internal-pty` child writes only the transcript to stdout. Its stderr is not a second copy of the program's stderr.
- [Inlined `index.js` and `watch-relay.js` disagree] → Node always spawns the relay file `relayModulePath()` already selects, which is the on-disk `watch-relay` module.

## Migration Plan

No state migration. A tty watch started after this change uses the new allocator; `down` stops it by the recorded pid as it does today. Rollback is reverting the change. Hosts that only had `script` need Bun on `PATH` or resolvable through Mise before a tty watch will start again.

## Open Questions

None. The window size is confirmed during implementation against the runtime, as the risk above says, and does not change the requirement.
