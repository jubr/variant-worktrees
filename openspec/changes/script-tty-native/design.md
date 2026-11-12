## Context

See [proposal.md](proposal.md) for why the terminal should be the runtime's pty, with `script` only as a later try. Behavior is [specs/variant-api/runtime | Watch output terminal](specs/variant-api/runtime/spec.md).

`spawnOnTerminal` in `packages/variant-api/src/watch-relay.ts` starts `bash`, holds a pipe open with `tail -f /dev/null`, then execs `script`. Linux passes `-c`. macOS passes the command after the typescript file. The typescript file is `/dev/null`. `stty cols 10000 rows 200` runs before the watch command. A leading `^D` and two backspaces are stripped from the transcript. The recorded pid is that `bash`/`script` process. `stopProcessTree` signals the process group and walks descendants.

The same `launchWatches` runs in the CLI (Bun), in `bun test` (Bun), in the compiled `variant` executable (Bun), and in the editor relay. The editor relay is the editor executable with `ELECTRON_RUN_AS_NODE=1`, so it is Node. `variant-api` is built with `--target node`. `dist/index.js` and `dist/commands.js` must load on Node 22.13 without a Bun-only import, and the existing source scan rejects a `Bun.` token in those two files. `dist/watch-relay.js` is a separate build entry. The extension bundles that relay and starts it with `process.execPath`.

util-linux `script.c` does not own the terminal. `lib/pty-session.c` does: `openpty`, `setsid`, `TIOCSCTTY`, dup the slave onto stdin, stdout, and stderr, then copy the master. Bun 1.4, the runtime pinned in `mise.toml`, does that session in `Bun.Terminal`: `openpty` on Linux and macOS, ConPTY on Windows. `cols` and `rows` set the window size. Leaving the terminal open keeps the slave's stdin open. Child output arrives on the `data` callback. `proc.stdout` is null when `terminal` is set.

## Goals / Non-Goals

**Goals:**

- Try allocators in the order in the runtime spec, and stop at the first that works.
- In-process allocation when this process is already Bun, including the compiled executable.
- The same allocator under a `bun` found by Mise or `PATH` when this process is Node.
- Keep today's `script` session as the try after those.
- When every try fails, warn and start that watch with pipes. Do not fail the watch.

**Non-Goals:**

- See proposal.md. In particular, no TypeScript `openpty` and no native pty addon.

## Decisions

**Use `Bun.Terminal` for every `bun` try, not a port of `script.c` and not `node-pty`.** The session this watch needs is the one `pty-session.c` already implements, and Bun 1.4 already exposes it. A TypeScript port would still have to call `openpty` or `CreatePseudoConsole`. Node cannot. `node-pty` is a native addon: its prebuilds do not match the editor's Electron ABI, `vsce package --no-dependencies` would not ship it, and `bun build --compile` would have to carry a `.node` file. Rejected.

**Call the runtime through `globalThis["Bun"]` inside the tty start, never at load, and never via `bun:`.** A static `Bun.` token fails the Node bundle scan even when the function never runs. A missing global means this process is not the in-process try. The scan stays. No-tty spawn stays `node:child_process`.

**Order.** Stop at the first success.

1. This process is Bun: `Bun.spawn` the watch command with `terminal`. Do not spawn Mise, `PATH` `bun`, or `script`.
2. `mise exec -- bun`, Mise being `miseBinaryFor(context.config, context.miseBinPath)`. No binary, or a non-zero probe, is a failed try.
3. `mise exec bun@latest -- bun`. Same probe rule. This try may download Bun. It runs only after step 2 fails.
4. `bun` resolved on `PATH`.
5. Today's `script` spawn, including the stdin hold and the `^D` strip.
6. `logW` a warning that names the watch and says the terminal was not allocated. Append that sentence to `.cache/variant/watch.log`. Start the watch with the pipe spawn. Do not write the `mode=tty` line for that watch. Leave the command running.

Steps 2 to 4 run `relayModulePath()` under that `bun` with `--internal-pty`. The child is Bun, so it takes step 1, and writes raw terminal bytes to stdout. The parent records that child pid. Handle the flag before the watch-relay entry. It is not `--internal-watch-relay`. Probe with a zero-work `bun` exit before starting the watch command, so a failed try does not launch the command twice.

**On a successful Bun terminal.** Command stays a shell string: `sh -c` of `launch.command`, with `colorTerm` applied to the environment. Window size is `cols: 10000`, `rows: 200`. Do not write to the terminal and do not close it while the child runs. The `data` callback is the transcript the line relay reads as stdout. Stderr is not a second stream. The recorded pid is the spawned shell, or the outer `bun`/`mise` pid when this process is Node. Hold the terminal object so it is not collected. `detached: true` on a Node-spawned outer process so `stopProcessTree` can signal the group.

**The `mode=tty` line.** Decide the allocator before writing the log header. Write the line only when at least one watch will actually run on a terminal, and write it before the `[name] {command}` banners.

## Risks / Trade-offs

- [Bun rejects a 10000-column window] → Request 10000. If the runtime refuses it, use the largest accepted size that is still at least 1000 and point the column assertion at that size.
- [`Bun.spawn` does not make the child a process-group leader] → `down` still walks descendants from the recorded pid. The terminal test covers `down`. Add a group only if that test shows a survivor.
- [`mise exec bun@latest` downloads] → It runs only after `mise exec -- bun` fails. A watch on a Node host with no project Bun pays that cost once per try, not on the Bun CLI path.
- [Editor host has no Mise and no `bun`] → `script` still allocates. When `script` is missing too, the watch runs with pipes and the warning is in the log.
- [Helper stderr looks like watch output] → The `--internal-pty` child writes only the transcript to stdout. Its stderr is not a second copy of the program's stderr.
- [Inlined `index.js` and `watch-relay.js` disagree] → A Node `bun` try spawns the relay file `relayModulePath()` already selects.

## Migration Plan

No state migration. A tty watch uses the first working allocator. A host that only has `script` keeps a terminal. A host with none of the allocators gets pipes and a warning instead of a failed start. Rollback is reverting the change.

## Open Questions

None. The window size is confirmed during implementation against the runtime, as the risk above says, and does not change the requirement.
