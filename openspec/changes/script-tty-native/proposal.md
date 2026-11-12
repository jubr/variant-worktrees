## Why

A `tty` watch shells out to the host `script` program to fake a terminal. Linux and macOS need different flags, a closed stdin makes `script` write `^D` into the terminal so a program such as vite exits, and Windows has no `script`. The session `script` creates is a pseudo-terminal with the command's standard streams attached to it, and the runtime already provides that session.

## What Changes

- A `tty` watch allocates its pseudo-terminal in the runtime. It does not run `script`, does not run `stty` to set the width, and does not hold stdin open with `tail`.
- The terminal contract stays: stdout and stderr are one terminal, the width is at least 1000 columns, a dumb or empty `TERM` becomes `xterm-256color`, stdin stays open for the life of the process, color reaches the log and an attached stdout, and the allocator does not write the `^D` echo.
- A Bun host does this in process. A Node host, including the editor's watch relay, runs that same allocator under the `bun` executable. When that executable cannot be found, the watch fails to start and the error names the watch.
- **BREAKING** A Node host that has `script` and does not have Bun can no longer start a `tty` watch.

## Capabilities

### New Capabilities

### Modified Capabilities

- `variant-api/runtime`: a `tty` watch allocates its own pseudo-terminal and does not require an external `script` program. A Node host that cannot find Bun fails that start with an error that names the watch.

## Impact

- `packages/variant-api` watch relay and the watch terminal tests. `down` still stops the recorded pid.
- The editor's detached watch. Its relay runs on the editor's Node and must find Bun.
- `CHANGELOG.md`. The watch-output sentences in `README.md`, `docs/guide/core.md`, `docs/guide/configuration.md`, and `packages/variant-vscode/README.md` stay accurate without naming `script`.

## Non-goals

- A TypeScript port of `script.c` or of util-linux `pty-session.c`. Those call `openpty`, which Node cannot do without a native addon.
- A `node-pty` dependency, or any other native pty addon. It does not load in the editor host, and it does not belong in the compiled `variant` executable.
- Keeping `script` as a fallback.
- Changing `no-tty` pipes, the log line format, the ANSI reset, or how the extension chooses the default mode.
- Feeding the caller's keyboard to a `tty` watch.
