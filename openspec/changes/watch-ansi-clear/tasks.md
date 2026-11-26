## 1. Strip in the relay

- [x] 1.1 Extend `packages/variant-api/src/watch-relay.spec.ts` with failing assertions for the scenarios of [specs/variant-api/runtime | Watch output has no clear-screen sequences](../../specs/variant-api/runtime/spec.md#requirement-watch-output-has-no-clear-screen-sequences): `2J`, `3J`, `H`, `;H`, `1;1H` and ESC `c` removed with the text kept, a clear before text in one line, a sequence split across two chunks, color kept with its reset, no reset for a line whose only escapes were removed, a line emptied by the strip skipped while an empty line stays, `2K` kept, same result for pipes and a terminal. Verify with `mise x -- bun test packages/variant-api/src/watch-relay.spec.ts`: the new assertions fail.
- [x] 1.2 Strip the sequences per complete line in `relay` before the reset check and skip a line the strip emptied. Verify with the command of 1.1: the file passes.

## 2. Operation and bundle

- [x] 2.1 Extend `packages/variant-api/src/operations/watch.spec.ts` with a failing attached `tty` case and a detached case that print clear codes before a message, and `packages/variant-vscode/src/watch-relay-bundle.spec.ts` with the same for the bundled `watch-relay.js`. Verify with `mise x -- bun test packages/variant-api/src/operations/watch.spec.ts packages/variant-vscode/src/watch-relay-bundle.spec.ts`: they pass once 1.2 is in (fail first if they run before it).

## 3. Docs and changelog

- [x] 3.1 Say in the `output.mode` text of `docs/guide/commands.md` and `docs/guide/configuration.md`, and in the watch paragraph of `README.md`, that clear-screen sequences are removed and color stays, and add a Changed bullet under `## Unreleased` in `CHANGELOG.md`. Verify each file says it and `mise x -- bun test scripts` passes.

## 4. Verification

- [x] 4.1 Run `mise x -- openspec validate --all --strict --no-interactive`, `mise x -- task check:all`, and `mise x -- task bleed:cli`; show in chat a minimal `variant watch` run of the bled binary that prints a clear code and shows a log line without it.
