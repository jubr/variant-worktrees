## Context

See proposal.md for why a rename API is out of scope. `packages/variant-vscode` today registers only `variant-worktrees.helloworld`. Tests import a tiny `mocks/vscode.ts` (`commands.registerCommand`, `window.showInformationMessage`). The generated VS Code API comment block in that file stays commented. esbuild marks `vscode` external.

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

Id `variant-worktrees.probeCursorCommands`, title `Variant: Probe Cursor Chat Commands`, activation event `onCommand:variant-worktrees.probeCursorCommands`. Keep the Hello World command and its activation event. Register the probe from `activate` and push the disposable onto `context.subscriptions`.

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

## Chat renamer

### Two packages

`chat-renamer-api` holds everything that does not import `vscode`: slash and pattern parsing, title numbering, the first-prompt reader, the hook installer and script, the settings normaliser, and the rename call itself over injected Cursor dependencies. `chat-renamer-vscode` wires that into an extension (`registerChatRenamer(context, { commandPrefix, configSection, log })`) and is also what `variant-vscode` embeds. The embedding host keeps its own command prefix and settings section so existing user settings survive. VS Code reads contributions only from the host's own manifest, so the host copies the three settings; a test fails when the copy drifts.

### Borrowed identity

Cursor gates `cursor.projectAgentHostSessionTitle` (and the catalog APIs) to the built-in `anysphere.cursor-agent-host` extension. The gate reads the calling extension description synchronously, so the renamer swaps `identifier`, `isBuiltin` and `enabledApiProposals` on the description for one call and restores them in `finally`. The user chose this route knowing it is version-fragile.

### Request parsing and numbering

Each prompt line is tried against the slash commands first (literal title), then against the activation patterns (first capture group that matched, else the whole match). Titles from patterns are numbered: strip trailing digits to get the base; peers are the other open chats' titles with the same base (case-insensitive); the result is `{base}{max + 1}`, a peer without a number counting as 1; no peers leaves the title as typed.

### Realtime only

The title-event trigger acts on the first title event of a chat, and only when the chat's first prompt was submitted after the renamer started listening and no more than 30 seconds ago. Cursor re-emits title events for existing chats when it loads them, so a chat that predates the renamer must never be renamed. If the first prompt cannot be read or has no timestamp, the chat is left alone; the earlier fallback that parsed the title text is removed because it has no timestamp to check.

### One active instance

Two extensions embedding the renamer each carry their own bundled copy, so the claim lives on `globalThis` under `Symbol.for("chat-renamer.owner")`, holding the claiming extension id. The first extension to activate owns the triggers (title-event listener, hook, URI handler). Another instance logs who owns it, removes any hook script it wrote earlier, and stays idle. The owner releases the claim on dispose. The commands stay registered in both because their ids differ and a user invokes them explicitly. Instances in different windows are separate processes and are not coordinated; the rename is idempotent.
