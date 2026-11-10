## 1. Watch output relay

- [ ] 1.1 Write failing tests in `packages/variant-api/test/watch.test.ts` for [specs/variant-api/runtime | The watch command runs watches as host processes](specs/variant-api/runtime/spec.md#requirement-the-watch-command-runs-watches-as-host-processes) and [specs/variant-api/runtime | Watch output log](specs/variant-api/runtime/spec.md#requirement-watch-output-log). Attached stdout `ready` appears as `[fe] ready` on stdout and in `.cache/variant/watch.log` while the process runs. Stderr `oops` appears as `[fe] oops` on stderr and in the log, not on stdout. A partial line is prefixed when the stream ends. The file is truncated on a second run, holds `[be] {command}` and `[fe] {command}` before the process lines, and `state.yaml` records the absolute log path. `down` removes `log` and keeps the file. `up` writes no log and records no `log`. Verify the new assertions fail first. Add `launchWatches` in `packages/variant-api/src/watch-relay.ts` and call it from attached `watch`. Verify `bun test packages/variant-api/test/watch.test.ts` passes.

- [ ] 1.2 Extend those tests for detach using the same `launchWatches`. A detached command that prints `ready` leaves `[fe] ready` in the log while it runs, the caller's stdout does not contain that line, and `state.yaml` records the log path. Output written after the call returns still reaches the file. The child is spawned on the relay module when that file exists, and on `process.execPath --internal-watch-relay` when the program is a compiled executable. The CLI handles that flag before command parsing. Verify `bun test packages/variant-api/test/watch.test.ts` passes.

## 2. Ready URL lines

- [ ] 2.1 Write failing tests in `packages/variant-api/test/watch.test.ts` for [specs/variant-api/runtime | Readiness and opening](specs/variant-api/runtime/spec.md#requirement-readiness-and-opening). The first probe of `be` at `http://demo.vw.localhost:62061` with `ready: /health` writes `[watch] be URL try http://demo.vw.localhost:62061/health` to stderr and to `watch.log`. The first status 200 writes `[watch] be URL 200 http://demo.vw.localhost:62061/health` once. Status 204 does not count: no 200 line, a warning, no browser. A watch with `ready` and no URL template logs `http://127.0.0.1:<port><ready>`. `fe` opens only after `be` answers. `variant.open: false` and `VARIANT_OPEN=0` log the 200 line and open nothing. Detach writes no try line and opens nothing. No `ready` path still prints and opens without a try line. Verify the new assertions fail first. Export `readyProbeLine` from `ready.ts` and poll status 200 on the joined URL. Verify `bun test packages/variant-api/test/watch.test.ts` passes.

## 3. Status and list

- [ ] 3.1 Write failing tests for [specs/variant-api/status | Uptime and watch log](specs/variant-api/status/spec.md#requirement-uptime-and-watch-log) and [specs/variant-api/commands | List default output](specs/variant-api/commands/spec.md#requirement-list-default-output). An attached watch whose state records `log` as `/work/_v-demo/.cache/variant/watch.log` returns that path from `status`, and `variant list` shows it in the log column. Verify `bun test` on the status test and the CLI list output test passes.

## 4. Tree loading

- [ ] 4.1 Write failing tests in `packages/variant-vscode/src/variants-view.spec.ts` for [specs/variant-vscode/variants-tree | Inline actions](specs/variant-vscode/variants-tree/spec.md#requirement-inline-actions). After play, the row stays on `loading~spin` until both `fe` and `be` have returned 200, the next check is one second later, and the row URL opens once when `be` is last. The extension log gets one debug line `[watch] fe URL try http://demo.vw.localhost:62100/index.html` and one `[watch] fe URL 200 ...`, and a later check does not repeat them. A dead `be` pid leaves the loading icon and does not open. One ready watch still opens as it does today. A watch with no `ready` is not fetched. Verify the new assertions fail first. Add `debug` to `ActivityLog`, poll every watch that has a URL and a `ready` path, and use `readyProbeLine`. Verify `bun test packages/variant-vscode/src/variants-view.spec.ts` passes.

## 5. Docs

- [ ] 5.1 Update `README.md`, `docs/guide/core.md`, `docs/guide/configuration.md`, `docs/mcp.md`, and `packages/variant-vscode/README.md`. Attached and detached `watch` prefix each line with `[name]` and write `.cache/variant/watch.log`. The first ready probe and the first 200 log the full URL. The tree keeps the loading icon until the last ready watch returns 200. Record the behavior under `## Unreleased` in `CHANGELOG.md`. Verify `task docs:build` passes.

## 6. Check

- [ ] 6.1 Verify `task lint`, `task test`, `task build`, and `mise x -- openspec validate --all --strict --no-interactive` pass.
