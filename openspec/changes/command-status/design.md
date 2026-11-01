## Context

`packages/variant-api/src/cli.ts` builds one cleye subcommand per entry of `commands[]` and always prints `JSON.stringify(redacted(result))`; `list` has a CLI-only `--table` flag. The runtime state of a variant is read by `listVariants` through `readRuntimes` (all variants) and `readVariantRuntime` (one worktree). The MCP server and the webview generate their tools and forms from the same definitions. See proposal.md for motivation.

## Goals / Non-Goals

**Goals:**

- One `status` operation in the library, exposed on the CLI, MCP and webview from one command definition.
- Output format is a presentation concern of the CLI only; results stay structured objects.

**Non-Goals:**

- Changing result types of existing commands.
- A plugin point for custom formats.

## Decisions

### `status` is a client operation, built on the `list` building blocks

Add `client.status(slug?)` and `operations/status.ts`. It resolves the slug like other commands, then reuses the pieces of `listVariants` (state file, database target, `runtimeBySlug`, `instanceFacts`) for one slug instead of listing all variants and filtering, and adds a `runtime` object. Those helpers move from `list.ts` into a shared module so both operations use them. The `runtime` object is the stored runtime section as `readRuntime` returns it (overrides and templates applied) plus `file` and per-instance `alive`.

Alternative: filter `list()` by slug. Rejected: it lists the whole database and drops the runtime meta that `list` does not carry (`db`, `dir`, `file`).

Alternative: return the raw `variants.local.yaml`. Rejected: it skips override resolution, liveness and redaction.

Unknown slug: status throws `Unknown variant: <slug>` when no state, database target or runtime exists. The CLI prints the message and exits 1 (existing error path); MCP returns an error result.

### Redaction stays one function at the output boundary

`redacted()` moves from `cli.ts` to `output.ts` and runs before every renderer (text, JSON, YAML). MCP keeps calling `JSON.stringify` on the raw result as today; `status` redacts `runtime.db.password` itself so MCP is safe too.

### Output: renderers in `output.ts`, selected in `cli.ts`

`renderOutput(name, result, { format, variantRoot })` returns the string to print. Formats are `text` (default), `json`, `yaml` (the `yaml` package already used by `state.ts`). Text renderers per command: `list` reuses `formatTable`; `status` prints key/value lines with an indented `runtime` block and an instance table; `up`/`watch` print slug, mode, worktree, target and one line per instance; `down`, `implode`, `create`, `provision` print a one-line summary plus the relevant lists; `config` prints the resolved configuration as an indented outline. Commands without a dedicated layout fall back to the indented outline, so a new command always has a text form and the "every command has text output" scenario holds without a per-command edit.

Alternative: default to YAML. Rejected: the user asked for non-JSON human output, and YAML would make `--yaml` redundant.

Alternative: a `--format json|yaml|text` flag. Rejected: the request asks for `--json` and `--yaml`.

### Global flags handled before cleye

cleye does not inherit root flags into subcommands, and a root flag after the subcommand name is rejected by `strictFlags`. `cli.ts` pulls `--json` and `--yaml` out of `argv` before the unknown-command check and before `cli()`, errors when both are present, and passes the chosen format to the command callback. The flags therefore work in either position and are not declared per command, so the per-command `Flags` help section does not repeat them.

Alternative: declare the flags on every command through `flagsFor`. Rejected: they would appear in each command's `Flags` section, which the user wants separate, and in generated MCP/webview inputs unless filtered.

### "Global flags" help section through cleye's custom help renderer

cleye's `help.render` receives the default help nodes. The renderer appends a `Global flags` section (`--json`, `--yaml`, `--help`, and `--version` at top level) and removes `--help` from `Flags`. The same list is a single constant used for the section, the early argv extraction, and the README text check in tests.

### `--table` is removed

`list` text output is the table, so `--table` has no remaining meaning. With `strictFlags` it now fails as an unexpected flag. Recorded as **BREAKING** in the changelog, together with the JSON default change.

### Webview and MCP

`status` appears in the webview and MCP automatically from `commands[]`; no per-surface code. The webview and MCP continue to receive structured results.

## Risks / Trade-offs

- [Scripts that parse CLI stdout as JSON break] → **BREAKING** entry in `CHANGELOG.md`, `--json` documented in README and docs, tests prove `--json` equals the old output.
- [Text layouts become an implicit contract] → text is documented as for people; `--json` and `--yaml` are the stable machine formats.
- [`status` and `list` drift] → shared helpers and a test asserting a status record contains the matching `list` record.
- [Merge overlap with `add-shell-completions`, which enumerates flags from definitions] → global flags are one exported constant that completions can read; whichever change lands second adds `status`, `--json` and `--yaml` to its tests.
- [cleye `help.render` API surface] → covered by help tests on `--help` output; fall back to post-processing the rendered string if the node shape differs.

## Migration Plan

Release as a pre-1.0 minor with the BREAKING changelog entry. Rollback is a revert; no stored state or schema changes.
