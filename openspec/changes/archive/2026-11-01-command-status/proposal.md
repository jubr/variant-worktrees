## Why

There is no way to ask what one variant is doing right now. `variant list` prints every variant, and the runtime facts of a variant (mode, directory, database settings, instance ports, pids and URLs) live in its `variants.local.yaml`, which users and agents must open by hand. Separately, every CLI command prints JSON, which suits agents but is hard to read in a terminal, and the output format cannot be chosen. The README and CLI help also mix flags that apply everywhere with flags of one command, and nothing obliges contributors to document new commands.

## What Changes

- Add a `variant status [slug]` command. It reports one variant: the facts `list` shows for it plus all the meta information of its runtime state (the `runtime` section of `variants.local.yaml`: slug, mode, directory, database settings, instances with port, pid, URL and liveness). Database passwords are redacted. It fails when nothing is known about the slug.
- Add a `variant_status` MCP tool. It derives from the same command definition, as would a webview form (none ships yet).
- **BREAKING** The CLI no longer prints JSON by default. Every command prints a human-readable text summary. `variant list` prints its table by default, so `--table` is removed.
- Add the global flags `--json` and `--yaml` that print the same result as JSON or YAML. They work on every command, before or after the command name. Giving both fails.
- Show the global flags in their own "Global flags" section in `variant --help`, `variant <command> --help` and the README CLI section, apart from the per-command flags.
- `variant list` gets a minimal default set of columns: `slug`, `mode`, `uptime`, the full `url`, the `log` file of the watch and `dir`. With `-v`/`--verbose` it shows all meta information of every variant, the same as `status` shows for one. `-v` becomes the short alias of `--verbose` on every command.
- Add what that needs: variants report `uptimeSeconds` (how long their recorded processes have run, from the system process table) and a detached `watch` writes the output of all its processes to one log file in the worktree, recorded as `runtime.log`, so users can `tail -f` it in real time.
- A detached `watch` that cannot start a process removes its log file instead of leaving an empty one.
- Add a CONTRIBUTING requirement: every added command or functionality is also added to the README and to the documentation under `docs/`.
- Docs: README CLI section, `docs/guide/core.md` (status, output formats, global flags), `docs/mcp.md` (new tool), `CHANGELOG.md`.

## Capabilities

### New Capabilities

- `variant-api/status`: the `status` command: what it reports for one slug, runtime meta information, redaction, and the failure for an unknown slug.
- `variant-api/output-formats`: the default text output, the `--json` and `--yaml` global flags, their placement, conflicts, exit codes, and the separate "Global flags" help section.

### Modified Capabilities

- `variant-api/commands`: the in-process execution list gains `status`; the list table view becomes the default text output with new columns, `--table` goes away, `list --verbose` shows all meta information, and `-v` aliases `--verbose`.
- `variant-api/runtime`: a detached `watch` writes a log file and records its path.
- `variant-config/core`: the `runtime` section gains an optional `log` path.
- `variant-mcp/tools`: new `variant_status` tool; `variant_list` accepts `verbose`.
- `docs/readmes`: the README CLI section lists the global flags separately and covers every command.

## Impact

- `packages/variant-api`: new `src/operations/status.ts`, new `src/output.ts` (text, JSON and YAML renderers), `src/uptime.ts` (process elapsed time), `src/operations/watch.ts` (log file for a detached watch), `src/cli.ts` (global flags, output selection, help section), `src/commands.ts`, `src/client` types and `src/index.ts`, `src/table.ts` stays as the list renderer; tests under `test/`.
- `packages/variant-config`: `runtime.log` in the schema, `variants.local.yaml.schema.json` and `variants.local.example.yaml`.
- `packages/variant-mcp`: no code change beyond the generated tool; test for `variant_status`.
- `CONTRIBUTING.md`, `README.md`, `docs/`, `CHANGELOG.md`.
- Specs: [specs/variant-api/status](../../specs/variant-api/status/spec.md), [specs/variant-api/output-formats](../../specs/variant-api/output-formats/spec.md).
- Callers that parse CLI stdout as JSON must add `--json`. MCP output stays JSON.
- Overlaps with the open `add-shell-completions` change: completions must also offer `--json`, `--yaml` and `status`; whichever lands second adapts.

## Non-goals

- Changing MCP output formats (always JSON) or the library API return types beyond the new `status()`.
- A `--format` flag, or output formats beyond text, JSON and YAML.
- A log file for an attached `watch` (its output stays on the console), for `up` containers (use the engine's logs) or for uptime of containers; `up` variants show `-` for uptime and log.
- Streaming or watching status (`--follow`), or status for all variants (that is `list`).
- Querying the database for liveness; status reads local state, runtime files and process liveness only.
