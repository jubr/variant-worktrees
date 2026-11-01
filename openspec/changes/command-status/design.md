## Context

`packages/variant-api/src/cli.ts` builds one cleye subcommand per entry of `commands[]` and always prints `JSON.stringify(redacted(result))`; `list` has a CLI-only `--table` flag. The runtime state of a variant is read by `listVariants` through `readRuntimes` (all variants) and `readVariantRuntime` (one worktree). The MCP server and the webview generate their tools and forms from the same definitions. See proposal.md for motivation.

## Goals / Non-Goals

**Goals:**

- One `status` operation in the library, exposed on the CLI, MCP and webview from one command definition.
- Output format is a presentation concern of the CLI only; results stay structured objects.

**Non-Goals:**

- Changing result types of existing commands, other than the additive optional `VariantRecord` fields `uptimeSeconds`, `log` and `runtime`.
- A plugin point for custom formats.

## Decisions

### `status` is a client operation, built on the `list` building blocks

Add `client.status(slug?)` and `operations/status.ts`. It resolves the slug like other commands and builds the record of that one slug with the same collection code `list` uses (state file, database target, discovered runtime state, instance facts), then attaches a `runtime` object. The code moves from `list.ts` into `operations/records.ts`, parameterised by an optional slug filter and a `verbose` switch for `runtime`. The `runtime` object is the discovered runtime section (templates replaced; `VARIANT_<KEY>_*` overrides do not apply, as in discovery, because they describe only the variant being run) plus `file` and per-instance `alive` and `uptimeSeconds`. The database adapter is still asked for its target list, because that is the only way to know whether a database target exists for the slug.

Alternative: return the raw `variants.local.yaml`. Rejected: it skips template resolution, liveness and redaction.

Unknown slug: status throws `Unknown variant: <slug>` when no state, database target or runtime exists. The CLI prints the message and exits 1 (existing error path); MCP returns an error result.

### One record builder for `list` and `status`; `list --verbose` is `status` per slug

The `list` building blocks move into a shared module that builds a `VariantRecord` for one slug, now including `uptimeSeconds` and `log`. `status` builds one record and always attaches `runtime`. `listVariants(context, { verbose })` builds the same records and attaches `runtime` only when `verbose`, so a verbose item equals `status` for its slug by construction (a test asserts it). `VariantRecord` gains optional `uptimeSeconds`, `log` and `runtime`; `client.list` takes an optional `{ verbose }`.

Alternative: call `status()` once per slug from `list --verbose`. Rejected: it reopens the database adapter per slug.

### Uptime from the process table

`src/uptime.ts` reads `ps -o etime= -p <pid>` (portable to macOS and Linux, unlike `etimes`) and parses `[[dd-]hh:]mm:ss` into seconds; a missing process or a failing `ps` gives no value. Only pids that are alive get one (`isProcessAlive`). The variant uptime is the maximum over its instances. No start time is stored, so nothing in `variants.local.yaml` can go stale and a restart is reflected immediately. `up` containers have no pid and so no uptime; asking the engine is out of scope (see proposal non-goals).

Alternative: record `startedAt` in the runtime state. Rejected: a second source of truth that outlives a crashed process, and a schema change for every writer.

### One log file for a detached watch

`watchVariant` with `detach` truncates `<variantConfigDir>/variants.watch.log`, appends the `[<key>] <command>` header lines, opens the file once for append and passes that descriptor as stdout and stderr of every child (`stdio: ["ignore", fd, fd]`), then closes it in the parent. The kernel writes child output straight to the file, so it is real-time, survives the CLI exiting, and needs no pipe or tee process. The path is recorded as `runtime.log` (new optional schema key). `*.log` is already git-ignored and the file lives in the worktree, so `implode` removes it with the worktree. `down` writes the runtime state again without `log` and keeps the file for post-mortems.

Alternative: a log per instance. Rejected: the table needs one location per variant and `tail -f` of one file shows the whole picture; the `[key]` header lines identify the processes.

Alternative: tee attached output through a pipe. Rejected: a pipe removes the TTY from the dev servers (colors, prompts); attached users already see the output.

### `-v` alias and verbose semantics

`short: "v"` is added to the shared `verboseArg`, which `flagsFor` already turns into a cleye alias. cleye's version flag is `--version` only, so `-v` is free. `--verbose` keeps its meaning of full provisioning output on the other commands; on `list` it means all meta information, and its description says both.

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
- [`status` and `list` drift] → one record builder and a test that every verbose list item equals `status` for its slug.
- [Uptime from `ps` is unavailable in a minimal container] → the value is omitted and the column shows `-`; nothing fails.
- [A huge log] → truncated at each start; no rotation (non-goal).
- [Wide table because of the full URL and log path] → intended; the minimal set stays six columns, and users wanting more use `-v` or `--json`.
- [Merge overlap with `add-shell-completions`, which enumerates flags from definitions] → global flags are one exported constant that completions can read; whichever change lands second adds `status`, `--json` and `--yaml` to its tests.
- [cleye `help.render` API surface] → covered by help tests on `--help` output; fall back to post-processing the rendered string if the node shape differs.

## Migration Plan

Release as a pre-1.0 minor with the BREAKING changelog entry. Rollback is a revert; no stored state or schema changes.
