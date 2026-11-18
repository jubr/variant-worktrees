## Context

See proposal.md for motivation. The site is VitePress (2.0 alpha, relative base) and `scripts/docs-site.spec.ts` already builds it and reads the HTML. Inline code uses `--vp-font-family-mono`, which is JetBrains Mono, and that font ligates `>=`. The Configuration page has `variant.<key>` headings (ids such as `variant-abbr`) and a `v-pre` block that holds all of the page. The registered commands, with their arguments and `mcpFixed` values, are exported by `variant-api` (`commands.ts`) and drive both the CLI and the MCP tools. The `variants.yaml` JSON schema lists every key and sub-key.

## Goals / Non-Goals

**Goals:**

- Every cross-reference is a deep link, and a test keeps it that way: no dead fragments, no unlinked key mentions.
- Headings that must exist are derived from the schema and from the registered commands, so a new key or command fails a test until it is documented.

**Non-Goals:**

- No new VitePress plugin, no markdown-it rule that auto-links keys. Links stay in the markdown, where a reviewer sees them.
- No change to how headings get their ids.

## Decisions

- **Ligatures: CSS, not text.** `code, pre` get `font-variant-ligatures: none; font-feature-settings: "liga" 0, "calt" 0`. The alternative is to insert a zero-width character between `>` and `=` in the sources. Rejected: copy and paste of a command would carry the invisible character, and every future `>=` needs the same care. The QA test covers the stylesheet (the cause), plus a text assertion that `<STEP>=no` is still in the page as typed, so nobody "fixes" it with an invisible character.
- **Link checking on built HTML.** A test walks every built page, collects `id` attributes and the `href`s that stay on the site (relative, resolved against the page), and fails on a missing id. The built HTML is the only place where VitePress's id generation for headings like `variant.watches.<key>.dir` is visible, so the test does not guess ids.
- **Key mentions: one rule, tested.** The set of linkable paths is read from the built Configuration and Chat Renamer configuration pages: the text of their `h3` (and `db.multi` `h2`) headings. A mention is an inline `code` element whose text equals one of them, outside a heading, outside `pre` and outside an `a`. Matching on exact text keeps `runtime.watches.<key>.port` (state, not configuration), `env.sourceFile` and partial names out of scope. The test also requires at least one found mention on five named pages, so a broken extractor cannot pass by finding nothing.
- **Sub-key headings are a flat `h3` list.** The outline has levels 2 and 3, so a flat list is what the reader sees. Sorting is by full path with a plain string comparison, so a parent precedes its children. The test generates the expected path list from the schema, with `<key>` for watch names and `<name>` for step names, and `db.multi.*` from the `db` schema. `variant.watches.<key>.env.sourceFile` and `.container.internalPort` use their full path.
- **One paragraph per heading, no option tables.** `variant.implode`, `variant.watches.<key>.*` and the other tables become headings with a paragraph each, so every row has an anchor. The text of each row moves unchanged, minus the earlier shapes the proposal drops.
- **Overview is the story, Core is the reference.** Core already describes each command's flags, `db.multi` behavior and step replacement; the Overview repeats part of it. Command steps shrink to what the step does plus a `More details at` sentence, so each fact has one home. Where a fact exists only in the Overview (the step replacement detail of `provision` and `deprovision`, the `--reprovision` sentence of `watch`), it moves to Core first. The 60-word limit gives the test something to hold. `seed` has no command and so no home in Core: it keeps its explanation and its full example in the Overview, as do the custom-step sections.
- **MCP page from the commands.** The MCP test imports `commands` the way `scripts/docs-coverage.spec.ts` does, expects `variant_<name>` `h3`s in registration order under *Available tools*, and per section a link to `core#<name>` and one table row per argument without an `mcpFixed` entry. A section says what is specific to the tool: the return value, a default that differs from the CLI, or the argument the tool fixes. Core remains the description of the command.
- **Runtime split.** *Starting* keeps what `up` and `watch` share. `Watching` (new `h2`) takes the three headings; *Up* (new `h2`) takes the `up`-only sentences. The anchors `#interactive-keys`, `#reattaching` and `#exit-status` stay the same, so no inbound link breaks; `#watching` and `#up` are new.
- **Earlier shapes are dropped from prose, not from behavior.** Nothing in the loader changes. A test searches `docs/` for the former names.

## Risks / Trade-offs

- A strict "every mention is a link" test makes prose edits fussier → the rule is limited to exact full key paths, and headings and fenced code are exempt.
- Heading ids for headings that contain `<` and `>` may be unexpected → the test reads ids from the built HTML, and the first task builds a heading with `<key>` and checks the id before the rest is written.
- Many more headings make the outline long on the Configuration page → accepted; it is the point of the request, and the sidebar is unaffected.
- The ligature rule loses the font's `->` arrows in code → intended; code shows what was typed.

## Migration Plan

Docs-only change. Roll back by reverting the commits. Inbound links to headings that this change renames (the option tables of `variant.implode` and `variant.watches`, the `Starting` anchor if retained) are updated in the same change, and the dead-fragment test proves it.

## Open Questions

- Whether the generic heading for a sub-key of a user-named entry should read `variant.watches.<key>.dir` or `variant.watches.*.dir`. The proposal picks `<key>`; changing it later only changes heading text and the test's expected list.
