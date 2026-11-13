## Why

A `tty` watch shells out to the host `script` program to fake a terminal. Linux and macOS need different flags, a closed stdin makes `script` write `^D` into the terminal so a program such as vite exits, and Windows has no `script`. The session `script` creates is a pseudo-terminal with the command's standard streams attached to it, and the runtime already provides that session. A host that cannot allocate one should still run the watch.

## What Changes

- A `tty` watch tries allocators in order and uses the first that works. It does not try a later one after an earlier one works.
- When this process is Bun, it allocates the terminal in process. It does not run Mise, a `bun` on `PATH`, or `script`.
- Otherwise it tries `mise exec -- bun`, then `mise exec bun@latest -- bun`, then `bun` on `PATH`. Each of those runs the same in-process allocator.
- Otherwise it tries `script`, with the same terminal contract as today: width, stdin held open, color in the log, and no `^D` echo.
- When none of those works, the watch starts with pipes, as `no-tty` does, and emits a warning that names the watch. The watch command still runs. That watch does not write the `mode=tty` line.
- The terminal contract for a watch that did get a terminal stays: stdout and stderr are one terminal, the width is at least 1000 columns, a dumb or empty `TERM` becomes `xterm-256color`, stdin stays open, and color reaches the log and an attached stdout.

## Capabilities

### New Capabilities

### Modified Capabilities

- `variant-api/runtime`: a `tty` watch tries the in-process terminal, then `mise exec -- bun`, then `mise exec bun@latest -- bun`, then `bun` on `PATH`, then `script`. When all fail, it warns and starts that watch with pipes.

## Impact

- `packages/variant-api` watch relay and the watch terminal tests. `down` still stops the recorded pid.
- The editor's detached watch. Its relay runs on the editor's Node and walks the same list.
- `CHANGELOG.md`, `README.md`, `docs/guide/core.md`, `docs/guide/configuration.md`, and `packages/variant-vscode/README.md`: a `tty` watch that cannot allocate a terminal runs with pipes and a warning.

## Non-goals

- A TypeScript port of `script.c` or of util-linux `pty-session.c`. Those call `openpty`, which Node cannot do without a native addon.
- A `node-pty` dependency, or any other native pty addon. It does not load in the editor host, and it does not belong in the compiled `variant` executable.
- Failing the watch when no allocator works.
- Changing an explicit `no-tty`, the log line format, the ANSI reset, or how the extension chooses the default mode.
- Feeding the caller's keyboard to a `tty` watch.
