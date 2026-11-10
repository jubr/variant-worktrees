## Why

Starting a variant from the tree clears the loading icon when the one watch that owns the row URL answers, so a second watch can still be down. An attached `variant watch` leaves process output only on the console, and a detached watch writes a different, unprefixed stream to `.cache/variant/watch.log`, so the same watches are hard to tell apart in either place.

## What Changes

- After the tree starts a watch, the row keeps the loading icon until every watch that has a URL and a `ready` path has returned HTTP 200. The tree checks each of those URLs once a second. The extension log records two debug lines per such watch: the first attempt and the first 200. The row URL still opens once in the external browser when that last 200 arrives.
- **BREAKING** Attached and detached `watch` capture every watch process through one relay. Each stdout line is written to stdout and each stderr line to stderr, as `[{name}] {line}`, where `name` is the watch key. The same lines are appended to `.cache/variant/watch.log` without blocking that console write. Detach still returns without a readiness check or opening URLs; the relay keeps running in the background and does not use the caller's terminal.
- **BREAKING** An attached `watch` truncates that log, records its absolute path as `log`, and keeps the file across `down` the same way a detached watch does.
- On the first probe of a watch that sets `ready`, stderr and the log gain `[watch] {name} URL try {url}`. On the first HTTP 200 they gain `[watch] {name} URL 200 {url}`. `{url}` is the rendered watch URL joined with `ready`. A watch with `ready` and no URL template still uses `http://127.0.0.1:<port><ready>`. Opening the watch URL stays after every such watch has returned 200, and `VARIANT_OPEN=0` or `variant.open: false` still skips the browser.
- A ready response counts only for status 200.

## Capabilities

### New Capabilities

### Modified Capabilities

- `variant-vscode/variants-tree`: the loading icon waits for the last ready watch, the check interval is one second, and the first try and first 200 are debug lines.
- `variant-api/runtime`: one relay prefixes and tees watch output for attached and detached `watch`, attached records `log`, and readiness logs the full URL on the first try and the first 200.
- `variant-api/status`: `log` is the watch log recorded for either attach mode.
- `variant-api/commands`: the `list` log column is that same path.

## Impact

- `packages/variant-api` watch spawn, readiness, and the watch tests.
- `packages/variant-vscode` tree confirmation and its tests. `ActivityLog` gains `debug`.
- `list` and `status` show `log` for an attached watch that recorded one.
- `README.md`, `docs/guide/core.md`, `docs/guide/configuration.md`, `docs/mcp.md`, `packages/variant-vscode/README.md`, and `CHANGELOG.md`.

## Non-goals

- A readiness check or browser open inside detached `watch`. The tree keeps doing that check itself.
- The tree reading `VARIANT_OPEN`.
- A debug line on every failed poll after the first try.
- A watch log for `up`, or a change to the React variants view.
- A probe of a watch that has no `ready` path, and no invented `/health`.
