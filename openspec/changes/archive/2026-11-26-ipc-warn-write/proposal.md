## Why

`variant implode` removes the worktree and the local branch, then prints `[warn] ipc write failed`. The editor does not answer the last log write within the one-second limit, and the CLI gives up on the socket. The command succeeded and nothing needs fixing, yet a `[warn]` line reads like a problem. The same line appears whenever the editor is busy or closed mid-command: the editor stream is best-effort, so a lost write is diagnostic detail, not a warning.

## What Changes

- **A stalled editor write is one debug line.** The CLI still drops the socket after a write waits one second, and still emits the event once. The event is `debug` (`[debug] ipc write failed`) instead of `warn`. It shows with `--log-level=debug` and is hidden at the default threshold.
- **No behavior change otherwise.** Timeout, one-time emission, skipping later events, and the command result are unchanged. `connected`, `connect failed` and `cli end` already are debug lines.

## Capabilities

### New Capabilities

### Modified Capabilities

- `variant-cli/logging`: the `write failed` event of the vscode log stream is a debug event, not a warn event.

## Impact

- `packages/variant-cli/src/ipc-vscode.ts` and its sibling spec `ipc-vscode.spec.ts`.
- `README.md` logging paragraph and `CHANGELOG.md`.
- No change to CLI flags, MCP tools, configuration keys or the socket protocol.

## Non-goals

- Fixing why the write stalls during `implode`.
- Changing the one-second write limit.
- Changing the editor extension or the MCP server's own socket writer.
