## Context

Attached `watch` spawns each process with `stdio: "inherit"`. Detached `watch` passes one file descriptor of `.cache/variant/watch.log` to every process, so the kernel writes raw bytes and the CLI can exit. Readiness in `ready.ts` polls `http://127.0.0.1:<port><ready>` and treats any 2xx as success. The tree polls only the watch that owns the row URL. See [proposal.md](proposal.md) for why that changes.

## Goals / Non-Goals

**Goals:**

- One function reads watch stdout and stderr, prefixes each line, and tees it to the console sinks and the log file.
- Detach keeps returning immediately, with that same function running in a process that outlives the CLI.
- The tree and `ready.ts` share the ready-URL line text.

**Non-Goals:**

- A public CLI command for the relay process.
- Probing or opening URLs inside detached `watch`.
- Changing `up` so that it writes `watch.log`.

## Decisions

### One relay, two hosts

`packages/variant-api/src/watch-relay.ts` exports the line relay and `launchWatches`. The relay buffers each stream on `\n` (a trailing `\r` is stripped). A leftover partial line is flushed when the stream ends. A stdout line is `[{key}] {line}\n` on the stdout sink. A stderr line uses the stderr sink. The same bytes go to a log `WriteStream`.

The console write does not wait on the file. If the file buffer is full, the line is queued and written when the stream drains. Lines stay in order. Each line is written promptly so `tail -f` can see it while the process runs.

Attached `watch` calls `launchWatches` in the command process. Sinks are the process stdout, the process stderr, and the log file. Stdin of each watch stays inherited.

Detach cannot use an in-process reader: the CLI exits, and a raw file descriptor cannot add a prefix. Detach spawns one child that calls the same `launchWatches` with no console sinks, only the log file. The child does not inherit the terminal. It reads a JSON launch plan on stdin (command, cwd, env, log path, start delay), writes one JSON line of pids to the parent, then closes that handshake. The parent records `state.yaml` from those pids and returns. The child stays detached until the watches end. It does not poll readiness or open URLs.

The child command follows the existing `variant ui` respawn. When the relay module is a real file, the parent runs `process.execPath` on that file. When the running program is a compiled executable (the embedded-script test already used for `ui`), the parent runs `process.execPath --internal-watch-relay`. The CLI handles that flag before command parsing and calls the same entry. `bun test` hits the on-disk file, so it does not re-exec the test runner.

The `[key] command` banner is written by `launchWatches` to stderr when a stderr sink exists, and always to the log, before the process starts. The relay does not prefix that banner a second time.

### Ready URL lines

`ready.ts` builds the probe URL with the same one-slash join the tree uses: the rendered watch URL plus `ready` when a URL template exists, otherwise `http://127.0.0.1:<port><ready>`. Success is status 200 only. The first poll and the first 200 each pass through one helper, `readyProbeLine(name, "try" | "200", url)`, which returns `[watch] {name} URL try {url}` or `[watch] {name} URL 200 {url}`. That helper is exported for the tree. The line goes to the progress log. Attached `watch` also appends it to the log file. `up` does not.

Opening stays where it is: after every ready watch has returned 200, open each URL template unless `variant.open` is already false (`VARIANT_OPEN=0` is applied when config loads). A 204 stays in the waiting set until timeout.

### Tree confirmation

`confirmStarted` loads `ready` for every watch key on the record that has a URL. Keys with no `ready` are skipped. Each remaining URL is fetched in one pass, then the loop sleeps one second. The loading icon stays until every remaining watch has returned 200. `ActivityLog` gains `debug`. The first fetch and the first 200 call `log.debug(readyProbeLine(...))`. The row URL opens once when the last 200 arrives. A dead pid on a watch that is not yet 200 releases the icon and does not open.

## Risks / Trade-offs

- [Public hostname does not resolve, port is open on 127.0.0.1] → The probe uses the URL it logs. Timeout still leaves the watches running. The tree already fetches that public URL.
- [Relay child exits] → Watch pipes break and the log stops. The child is detached and unref'd, and the parent does not signal it on return.
- [Compiled binary looks like a script] → The embedded-script test selects `--internal-watch-relay`. A runtime test covers the on-disk spawn; the existing compiled-CLI suite covers the flag only if it already builds a binary. Do not add a new compile step for this change.
- [File buffer lags the console] → Accepted. The console write is not delayed. The queue still lands every line in the file.
- [Attached stdin] → Stdin stays inherited so a watch that reads it still can. Only stdout and stderr are piped.

## Migration Plan

No state migration. The next `watch` truncates `watch.log` and writes prefixed lines. `log` in `state.yaml` appears for an attached watch from that run. `down` still clears the key and leaves the file.

Rollback is reverting the change. An old build ignores a `log` path it does not understand only if it predates detached logs; current builds already read `log`.

## Open Questions

None. Detach stays off the caller's terminal. The tree does not read `VARIANT_OPEN`.
