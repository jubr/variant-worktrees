## Why

The documentation pages read as separate islands: a reader who meets `variant.mise.binPath`, a step name or an MCP tool has to search for where it is explained. Some options only have a prose paragraph, the MCP page repeats Core instead of linking to it, and the monospace font renders `<STEP>=no` as `<STEP≥no` because `>=` becomes a ligature, which makes a command look wrong.

## What Changes

- **Code ligatures off.** Code in the site renders `>=`, `<=`, `=>`, `!=` and similar pairs as the characters that were typed, so `VARIANT_STEP_<STEP>=no` reads as written. A QA test pins this.
- **Deep links everywhere.** A link from one page into another targets the heading that explains the topic (`overview#flow-of-steps`, `core#init`, `configuration#variant-steps`), not the page top. A QA test fails on any link whose `#fragment` has no heading in the built target page.
- **Configuration keys are links.** Every inline-code mention of a full key path (`variant.baseBranch`, `variant.mise.binPath`, `variant.watches.<key>.dir`, `db.multi`, `chatRenamer.awake.when`) outside its own heading links to the heading of that key. A QA test fails on an unlinked mention.
- **Configuration page.**
  - Every sub-key of an option gets an `H3` of its own, in alphabetical order after its parent: `variant.implode.maxDiffLines`, `variant.mise.binPath`, `variant.ports.range`, `variant.supervise.readyTimeoutSeconds`, `variant.ui.port`, `variant.storage.dir`, the options of a step (`variant.steps.<name>.cmd`) and of a watch (`variant.watches.<key>.dir`, `.env.sourceFile`, `.container.dockerfile`, ...), and the keys of `db.multi`. The tables that held them become one paragraph per heading.
  - *Templates* lists every placeholder in a table (`${slug}`, `${schema}`, `${storage}`, `${worktree}`, `${url}`, `${port}`, `${<watch>.port}`, `${abbr}`, `${multi.tenants}`, `${multi.schemaPrefix}`, `${NAME}`, `${NAME:-default}`, `$${`).
  - *Options* ends with a `chatRenamer.*` entry that links to the Chat Renamer configuration page.
  - `variant.steps` links to the flow in the Overview with its anchor (`overview#flow-of-steps`).
  - Earlier configuration shapes are no longer named in the docs: they stay supported, silently. This covers the former `variant.instances` and `variant.reservedPorts`, the former list shape of `steps`, `run` read as `cmd`, `{{...}}` templates, and the legacy state files.
- **Overview.** The Overview is the short story of the flow. Each builtin step that is a command (`create`, `provision`, `watch`, `down`, `deprovision`, `implode`) is reduced to a minimal explanation of what it does, with no list of options or flags and no configuration example, and ends with `More details at [<command>](core#<command>).`. The detail that is dropped is already in, or is moved to, that command's section in Core. A step with no command of its own, `seed`, and the *Custom Steps* and *Custom multi-tenancy steps* sections keep their full explanation and full configuration example, and link to the configuration keys they use (`variant.steps`, `variant.seed`, `db.multi`, `db.multi.schemaPrefix`).
- **MCP page.** *Available tools* becomes one `H3` per tool. Each links to the same section of Core (`core#init`), says only what differs from the CLI command, and has a table of the tool parameters.
- **Chat Renamer configuration page** takes the structure of the Variant Worktrees Configuration page: Options with one `H3` per `chatRenamer.<key>` and sub-key, alphabetical, the editor settings after it.
- **Library page.** Its *Configuration* section, now a copy of a sample file, becomes a list of deep links into the Configuration page.
- **Runtime page.** A new `Watching` heading holds *Interactive keys*, *Reattaching* and *Exit status* as `H3`s. What is specific to `up` moves to its own `Up` heading after `Watching`.
- **Getting Started, Core, Installation, Extension, Socket IPC** gain deep links to the headings that explain what they mention.

The sidebar already lists Library directly after Building under Development, so that order stays and is pinned by the existing sidebar requirement.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `docs/site`: modifies *Runtime page* (Watching and Up headings) and *Configuration page structure* (sub-key headings, the templates table, the `chatRenamer.*` entry, the Overview deep link, no earlier shapes named); adds *Code does not use ligatures*, *Links target headings*, *Configuration keys are links*, *Overview steps are short and link to commands*, *MCP tools have a heading each* and *Chat Renamer configuration page structure*; extends *Library page shows code* with the deep links of its configuration section.

## Impact

- `docs/guide/*.md`, `docs/mcp.md`, `docs/chat-renamer/*.md`, `docs/development/building.md`, `docs/index.md`, `docs/.vitepress/theme/custom.css`.
- `scripts/docs-site.spec.ts` (new QA tests on the built site); the MCP heading test reads the registered commands of `variant-api`.
- Inbound links to moved or renamed headings in `README.md` and `packages/*/README.md`.
- `CHANGELOG.md`.

## Assumptions

- "Escape `>=`" means the reader must see the typed characters. The text stays as typed, so copy and paste still work, and the fix is in how code is drawn (ligatures off), not in the text.
- "Sub-key" means a key one or more levels below a key of `variant`, `db.multi` or `chatRenamer`; each gets an `H3` in a flat list (alphabetical by full path), so the "On this page" outline, which shows levels 2 and 3, lists all of them.
- For watch and step options that sit under a user-chosen name, the heading uses the placeholder form `variant.watches.<key>.dir` and `variant.steps.<name>.cmd`.
- Overview "minimal" is measured as at most 60 words of explanation per command step, before the closing `More details at ...` sentence. Core stays the place where a command's flags, defaults and configuration are described.
- The "Up" heading gathers the statements about `up` that are now spread through *Starting* (recreates the target, stops recorded processes, records no `log`, container engine calls). No behavior is described that the page does not already state.
- The rewrite of a configuration file from an earlier version stays documented as a mechanism (in place, `git diff`, `VARIANT_MIGRATE=0`, `CI`) without naming the former keys or shapes.

## Non-goals

- No change to the CLI, library, extension, MCP behavior or the config schema.
- No new pages and no sidebar change.
- No rewrite of `README.md` files beyond fixing links to renamed headings.
- No shortening of Core, of the intro of the Overview, or of the sections for steps without a command.
