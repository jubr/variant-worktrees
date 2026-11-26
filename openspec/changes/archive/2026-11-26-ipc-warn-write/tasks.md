## 1. Write failure is a debug line

- [x] 1.1 Change the test `warns once and stops when a write is not answered within one second` in `packages/variant-cli/src/ipc-vscode.spec.ts` to the scenarios of [specs/variant-cli/logging | Vscode log stream](../../specs/variant-cli/logging/spec.md#requirement-vscode-log-stream): threshold `debug` gives exactly one `[debug] ipc write failed` line and the CLI finishes within 1.8 seconds, and the default threshold (`warn`) prints no `write failed` and no `[warn]` line. Verify with `mise x -- bun test packages/variant-cli/src/ipc-vscode.spec.ts`: the new assertions fail.
- [x] 1.2 Emit the event with `logD` in `dropSocket` of `packages/variant-cli/src/ipc-vscode.ts`, dropping an unused `logW` import. Verify with the command of 1.1: the file passes.

## 2. Docs and changelog

- [x] 2.1 Say in the logging paragraph of `README.md` that a write that waits one second is one `[debug] ipc write failed` line, and add a Changed bullet under `## Unreleased` in `CHANGELOG.md`. Verify with `mise x -- bun test scripts`.

## 3. Verification

- [x] 3.1 Run `mise x -- openspec validate --all --strict --no-interactive`, `mise x -- task check:all`, and `mise x -- task bleed:cli`; show in chat a minimal command of the bled binary against a listener that never answers: `--log-level=debug` prints `[debug] ipc write failed` and the default prints no `write failed` line.
