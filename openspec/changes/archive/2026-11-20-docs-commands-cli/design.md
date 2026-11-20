## Context

`CLI_ONLY_COMMANDS` (`variant-cli`) already names `ui`, `mcp`, `completions`; `commands[]` (`variant-api`) holds the rest. The docs tests (`scripts/docs-coverage.spec.ts`, `scripts/docs-site.spec.ts`) hard-code command names and heading shapes. VitePress derives heading ids from the text with backticks dropped, so ``### `variant create` `` gets the id `variant-create`.

## Goals / Non-Goals

**Goals:** one source of truth for which section a command belongs to; docs structure enforced by tests that read it; stable, descriptive deep links.

**Non-Goals:** changing command behavior or flags; redirects for the old anchors; restructuring README or MCP page beyond link targets.

## Decisions

- **`section` is a single value.** `type CommandSection = "basic" | "lifecycle" | "cli"`, exported with `COMMAND_SECTIONS` from `variant-api/commands`. `CommandDefinition.section` is `"basic" | "lifecycle"`. `variant-cli` maps its CLI-only commands to `"cli"`. Alternative: a list per command, so `init` is in two sections. Rejected: one command, one heading, one anchor.
- **`init` is `basic`.** Its full heading is under *Basic commands*, and so is its link on the CLI page. The *Lifecycle commands* intro does not name `init`.
- **Docs tests derive from the tags.** Commands page: the `###` headings under each `##` equal `` `variant <name>` `` of that section, in registry order after `init`. `docs-coverage` expects ``\n### `variant <name>` `` for every registered command. CLI page: `## Basic commands`, `## Lifecycle commands` and `## CLI-only commands` exist, in that order after the existing sections, the last is `## CLI-only commands`, the two list sections contain exactly the deep links `./commands#variant-<name>` of their `section`, and the CLI-only headings equal the `cli` commands.
- **Link label rule.** A test scans the built pages for links whose target is `commands#…` or `cli#variant-…` and requires the label to equal the code text `` `variant <name>` `` of the target heading. The existing no-dead-fragment test covers the anchors.
- **Where the `ui` text goes.** `ui` moves verbatim to the CLI page under ``### `variant ui` ``; `mcp` and `completions` move verbatim under their headings. The Commands page does not mention them; its intro points to the CLI page for the commands of the executable.
- **Option separator.** A raw `<hr class="option-sep">` before every option heading (`###`) of the Variant options and Database options sections except the first below its `##`. CSS in `custom.css` gives the rule `margin: 12px 0` and the heading after it `margin-top: 12px`, against VitePress's 24px rule margin and 32px heading margin. Markdown `---` would also work, but a class lets the CSS target only options.
- **Task order inside the change.** Code tags and their test first (TDD), then the failing docs tests, then the docs.

- **Global options are taken out before cleye runs.** Like `-C`, `--log-level` and `--json`, `-s`/`--slug` and `-v+` are removed from the arguments in `cli.ts` wherever they stand, so strict flag parsing never sees them and commands without a slug ignore them with no code of their own. The slug reaches `collectArgs` as a parameter instead of a flag or positional. The per-command flag lists leave out `slug`; the shell scripts keep it, since they complete its value.
- **A stray positional fails.** With the positional slug gone, `variant implode preview-one` would otherwise ignore `preview-one` and act on the slug of the current branch. Lifecycle commands therefore fail on any positional argument and say to use `-s`.
- **`-v` is the log level.** `-v` leaves `--verbose` (no short form now) so `-v`, `-vv`, `-vvv` can map to `info`, `debug`, `trace`. A longer run is `trace`. `--log-level` wins.
- **`warning` is a hidden alias.** It stays in the parser; the help text, the bad-value message and the docs list the five levels only.
- **`--help` shows the version first.** The top-level help (also `variant` alone) writes the same text `--version` prints, a blank line, then the help; the help's own `variant v<version>` line is dropped. Command help is unchanged.
- **Global flags close the CLI page.** *Global flags* moves below *CLI-only commands* and absorbs the Slug section. The heading keeps its name, as in the help.
- **Separator spacing.** `hr.option-sep` margin 16px (was 12px), following heading 20px (was 12px); the VitePress defaults are 24px and 32px.

## Risks / Trade-offs

- [External links to `commands#create` break] → Docs-only site; accepted and listed as BREAKING in the changelog.
- [Raw HTML in Markdown is easy to forget on new options] → The docs test fails when an option heading lacks the rule.
- [`-v` changes meaning] → Listed as BREAKING in the changelog; `--verbose` keeps the old behavior.
- [A stray positional fails where it was ignored] → Intended: it avoids acting on the wrong variant.
