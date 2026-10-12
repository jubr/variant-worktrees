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

### Realtime title events

The title-event trigger acts on the first title event of a chat, and only when the chat's first prompt was submitted after the renamer started listening and no more than 30 seconds ago. Cursor re-emits title events for existing chats when it loads them, so a chat that predates the renamer must never be renamed. If the first prompt cannot be read or has no timestamp, the chat is left alone; the earlier fallback that parsed the title text is removed because it has no timestamp to check.

### One active instance

Two extensions embedding the renamer each carry their own bundled copy, so the claim lives on `globalThis` under `Symbol.for("chat-renamer.owner")`, holding the claiming extension id. The first extension to activate owns the triggers (title-event listener, hook, URI handler). Another instance logs who owns it, removes any hook script it wrote earlier, and stays idle. The owner releases the claim on dispose. The commands stay registered in both because their ids differ and a user invokes them explicitly. Instances in different windows are separate processes and are not coordinated; the rename is idempotent.

### Worktree path mentions

A dragged-in worktree arrives as `@/abs/path/_v-my-slug`. For every configured prefix the renamer derives the pattern `/[a-z]+-spec-[a-z]+\s+@\S*/<escaped prefix>([A-Za-z0-9_-]+)/?(?=\s|$)` and tries it before the user's own patterns; the greedy `\S*` makes the last path segment win. A prefix carries its own leading character and connector (`_v-`), so the pattern inserts nothing between prefix and slug. The prefix list is the `worktreePrefixes` setting (default `["_v-"]`, empty turns the feature off) plus whatever the host adds. `variant-vscode` adds `variant.prefix` from `variants.yaml`, read with a light `readPrefix` helper so no database detection runs in the extension host. The prefix itself is a new optional `variant.prefix` key (default `_v-`) in `variant-config`. It is called `prefix`, not `worktreePrefix`, because it names every per-variant artifact (worktree directories now, database schemas and the like later); `variant-api` names new worktrees `<prefix><slug>` so the config is not decorative. The default lives in `variant-config`; `chat-renamer-config` does not know it, and the renamer's own `worktreePrefixes` default merely happens to be the same literal.

### Shared configuration

`chat-renamer-config` owns the full set of renamer options: `trigger`, `hookScope`, `activationPatterns`, `worktreePrefixes`, `renameExistingDays`. It has no runtime dependency except Zod and two entry points: `.` exports plain constants (the five defaults, `TRIGGERS`, `HOOK_SCOPES`) and plain predicates, `./schema` exports a Zod schema per option and the strict object `ChatRenamerConfigSchema` of all of them. The split keeps Zod out of the extension bundle, which only needs the constants. `chat-renamer-api` takes its defaults from `.`. `variant-config` adds `chatRenamer: ChatRenamerConfigSchema.optional()` as a top-level `variants.yaml` section and a light `readChatRenamerConfig` reader; `variant-vscode` reads it and hands it to `registerChatRenamer` as host-supplied values.

### Settings precedence

Three layers per option: an option the user set explicitly in the editor (global, workspace or folder value, found with `getConfiguration().inspect`) wins; then the host-supplied value from `variants.yaml`; then the default, which is whatever the editor reports for an unset option. Manifest defaults are copies of the shared defaults and a test keeps them equal. The existing-chats runner reads the same resolved settings as the trigger.

### Example configuration

`packages/variant-config/variants.example.yaml` sits next to `variants.yaml.schema.json` and specifies every option with an illustrative default, listing alternatives in end-of-line comments. A test validates it against the schema and walks the JSON schema (including array items and record values) to fail when the example misses an option.

### Existing chats

Setting `renameExistingDays` (non-negative integer, default 7, 0 = off). A pure planner takes, per chat, its creation time (the first human prompt's timestamp from Cursor's store) and its derived request, groups pattern titles by base (case-insensitive), orders each group oldest first, and gives the first the plain base and the n-th `{base}{n}`; slash titles stay literal. A chat is renamed only when its title differs from the plan.

The orchestration lists chats through `cursor.listAgentHostSessionCatalog`, skips chats already recorded in the renamer's global state, skips chats whose catalog `updatedAt` is older than the window (a chat cannot have been created after it was last updated, so no prompt read is needed), skips chats created after startup (the realtime path owns those) or before the window, reads each remaining first prompt once (no retry), plans, renames, then records every examined chat so a title the user later changes by hand is not reverted at the next startup. Chats whose prompt cannot be read are not recorded and are retried next time. Chats outside the window are not recorded, so widening the window later picks them up. The numbering covers only the chats examined in that run; chats recorded by an earlier run or outside the window keep their titles.

It runs shortly after startup, again after the burst of title events Cursor emits when it finally loads existing chats (debounced), when the setting changes, and on command `<prefix>.renameExistingChats`. The command ignores the record, since the user asked for it explicitly, but obeys the window: with 0 it does nothing and says which setting switched it off.

### Log marking

Every line of this feature starts with `[existing-chats]`. A run first logs its trigger (`startup`, `title events settled`, `setting changed`, or `command`) and the exact setting it obeys with its value, as `<section>.renameExistingDays=7`, plus the window start. When the setting is 0 the log says the feature is off and names the setting; each applied rename logs the chat id, old and new title and creation time; a summary line counts listed, examined, renamed and failed chats.

Known limits: the catalog may be incomplete at startup (hence the debounced second run); with the default 7 days, a title the user set by hand within that window before the first run is replaced when the chat's first prompt holds a rename request; each chat costs two `sqlite3` calls.
