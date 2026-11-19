## Why

A `watch` keeps running when its worktree is removed (`variant implode`, or a plain `rm -rf`). A detached one, which outlives the command that started it, keeps running its watch processes and keeps writing under a directory that no longer exists. An attached one stops, but its cleanup can write there too and does not clean the variant like an implode. Those writes can recreate `.cache/variant/` and its files, so an imploded variant leaves debris behind and its processes keep running.

## What Changes

- **Every watch watches its worktree.** A detached watch (its relay) and an attached watch both check every `supervise.checkoutPollSeconds` (default 5, `0` turns it off) that the worktree they were started for is still the same directory.
- **A vanished worktree ends the watch.** When the worktree directory is gone, the watch stops every watch process with its descendants and implodes the variant. The implode must work when the directory is already gone. The attached watch's database drop and runtime-state clear become that same cleanup; its exit status stays 1.
- **The cleanup is loud.** Before each action it emits a `warn` event with step `watch-cleanup`: the path found gone, each process stopped, each file or directory removed (absolute path), containers, the database target, `git worktree prune`, and the kept branch. The CLI keeps those events off the editor socket. A detached watch writes them to the standard error it inherited from the command that started it.
- **Nothing is written meanwhile.** From the moment the watch sees the worktree is gone, it writes no file under that directory: no `watch.log` line, no `in.sock`, no state or runtime file, no log directory. An implode of a missing worktree writes nothing under it either.
- **No data loss.** The cleanup implode keeps the local branch. The watch never deletes work that a plain directory removal left on a branch.

## Capabilities

### New Capabilities

### Modified Capabilities

- `variant-api/runtime`: a watch, attached or detached, stops its processes and implodes the variant when its worktree directory disappears, announces each step as a warning, and writes nothing under that directory afterwards.
- `variant-api/implode`: imploding a variant whose worktree directory is already gone writes nothing under that directory and can announce each action.
- `variant-cli/logging`: events with step `watch-cleanup` stay on standard error and are never sent to the editor socket.

## Impact

- `packages/variant-api/src/watch-relay.ts` (relay plan, directory check, guarded log, inherited standard error), `operations/watch.ts` (plan carries slug and the surviving working directory; the attached checkout outcome uses the shared cleanup), a new shared cleanup module, `operations/implode.ts` and the runtime-state helpers it calls, `packages/variant-cli/src/ipc-vscode.ts` (the local-only steps).
- `docs/guide/` runtime/commands pages, the `supervise.checkoutPollSeconds` description (`variants.example.yaml`, schema comment) and `CHANGELOG.md`.
- No change to the CLI flags or the MCP tools.

## Non-goals

- A new setting: the existing `supervise.checkoutPollSeconds` governs the check.
- Cleaning up a variant whose relay is not running (a watch that was stopped, or a machine that restarted).
- Sending the cleanup warnings anywhere that lives under the worktree, such as the editor socket or a file.
