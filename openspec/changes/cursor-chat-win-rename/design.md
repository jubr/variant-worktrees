## Context

See proposal.md for why a rename API is out of scope. `packages/variant-vscode` today registers only `variant-vscode.helloworld`. Tests import a tiny `mocks/vscode.ts` (`commands.registerCommand`, `window.showInformationMessage`). The generated VS Code API comment block in that file stays commented. esbuild marks `vscode` external.

## Goals / Non-Goals

**Goals:**

- Keep matching and report formatting pure so tests inject a command-id list.
- Read the host list with internal commands included, then render one replace-in-place output channel.
- Leave Hello World registration and behavior in place.

**Non-Goals:**

- Calling `vscode.commands.executeCommand` on a hit, or accepting a chat id and a new title.
- Uncommenting or vendoring the full VS Code API stub.
- Caching command ids across editor restarts.

## Decisions

### Pure filter, thin command callback

Add `selectCursorTitleCommands(ids: readonly string[]): string[]` in `packages/variant-vscode/src/cursor-command-probe.ts`. It keeps ids that match both `/cursor|composer|aichat|agent/i` and `/rename|title|label/i`, drops duplicates, and sorts with the default UTF-16 `Array.prototype.sort`.

The command callback asks `vscode.commands.getCommands(true)`, formats the result, and writes the channel. `true` is required: palette-only `getCommands(false)` hides the internal ids this probe exists to surface.

Alternative considered: filter inside `extension.ts` and test only through `activate`. Rejected because the host list would be fixed by the mock and the match table would be harder to drive.

### One channel, cleared each run

Use `vscode.window.createOutputChannel("Cursor Command Probe")`, then `clear()`, write lines, then `show()`. The same name returns the existing channel on later runs; `clear()` makes the second run a fresh report. `appendLine` without `clear()` would concatenate runs.

Empty input writes exactly `No rename-like commands found in this build.` Matches write one id per line and nothing else. No preamble, so the channel text is the report.

### Do not execute hits

The callback never calls `executeCommand`. A discovered id is evidence about this Cursor build, not a supported operation. Invocation stays a manual, out-of-band experiment by a developer who accepts breakage on the next Cursor release.

### Command contribution

Id `variant-vscode.probeCursorCommands`, title `Variant: Probe Cursor Chat Commands`, activation event `onCommand:variant-vscode.probeCursorCommands`. Keep the Hello World command and its activation event. Register the probe from `activate` and push the disposable onto `context.subscriptions`.

### Tests and the vscode mock

Colocate `cursor-command-probe.spec.ts` with the pure function (`CONTRIBUTING.md` `{file}.spec.ts` rule). Extend `extension.test.ts` for registration, channel name, `getCommands(true)`, replace-on-second-run, and "does not execute". Extend `mocks/vscode.ts` with `commands.getCommands`, `commands.executeCommand`, and `window.createOutputChannel` returning `{ clear, appendLine, show }`. Do not revive the commented API dump.

### Docs

Add a short README section in `packages/variant-vscode`: the command lists candidates in the current editor; a listed id is not a stable rename API; the extension does not call it. No VitePress page.

## Risks / Trade-offs

- [Substring `agent` plus `title`/`rename`/`label` can list unrelated commands] → Accepted. The probe is a diagnostic. README states a hit is not a supported API.
- [Cursor adds, renames, or removes internal commands between releases] → No allow-list. Each run reads the current process.
- [Someone treats a listed id as safe to execute] → Extension never executes it. README forbids treating the list as a contract.
- [Output channel name collides with another extension] → Accepted. The name is specific to this probe.

## Migration Plan

Additive. Ship the command contribution, module, mock stubs, tests, and README note together.

Rollback: remove that command, its activation event, the module, the new tests, and the README note. Hello World remains. No stored state to migrate.
