## Why

`variant-api` only works under Bun: its sqlite adapter imports `bun:sqlite`, its implode cleanup uses `Bun.Glob`, and its built entry points load both statically. That blocks every consumer that runs on Node (an editor extension host, `npx` users of the MCP server), and it makes the library carry the `variant` CLI, its output formatting and the `cleye` dependency that library users never use. The planned editor view and web server need a library that runs on Node and a CLI package they can extend without making the library depend on them.

## What Changes

- Make `variant-api` run on Node.js 22.13 or newer as well as on Bun: a sqlite variant is created, listed and removed through `node:sqlite` under Node and `bun:sqlite` under Bun, each loaded only when a sqlite variant is used; the implode cleanup patterns are matched by a runtime-neutral glob with the same results as before.
- Add a `variant-cli` package that owns the `variant` command: the command-line wiring, the help rendering and the text, JSON and YAML output. It calls `variant-api` in-process. The single-file release executables are built from it.
- **BREAKING**: `variant-api` no longer ships the `variant` executable and no longer depends on `cleye`. `npm install variant-api` gives the library only; `npm install -g variant-cli` gives `variant`. Release executables keep their names.
- `variant --version` reports the version of `variant-cli`; all release packages, now including `variant-cli`, keep one lockstep version.
- No change to commands, flags or output of `variant`, to the library's results, or to the MCP tools.

## Capabilities

### New Capabilities

- `variant-cli/package`: the package that provides the `variant` command: what it installs, how it reports its version and which runtimes it runs on.
- `variant-api/node-runtime`: the library loads and works under Node and Bun, including sqlite variants and implode cleanup patterns.

### Modified Capabilities

- `variant-api/commands`: the `variant` CLI reports the version of the `variant-cli` package.
- `meta/release-artifacts`: the lockstep release version covers `variant-cli`.

## Impact

- New `packages/variant-cli`: receives `cli.ts`, `cli-args.ts`, `help.ts`, `output.ts`, `text.ts`, `table.ts`, `duration.ts` and their tests from `packages/variant-api`; `bin: variant`.
- `packages/variant-api`: loses the CLI files, the `bin` entry and `cleye`; `db/sqlite.ts` and `cleanup.ts` become runtime-neutral; `engines.node` is set; `redacted` becomes a public export for the CLI; the CLI test helper moves with the tests.
- Root build, test, `Taskfile.yaml` (`bin:bun-shebang`, `package:cli`), `scripts/package-cli.ts`, `scripts/release-version.ts`, CI workflows that name package paths, `bun.lock`.
- `docs/guide/installation.md`, `README.md`, `docs/guide/core.md`, `CHANGELOG.md`, `AGENTS.md` (file structure).
- Specs: [specs/variant-cli/package](../../specs/variant-cli/package/spec.md), [specs/variant-api/node-runtime](../../specs/variant-api/node-runtime/spec.md).
- Sequencing: stacks on `command-status`, which adds the output formats and `status` command that move with the CLI; their spec paths under `variant-api/` stay where they are.

## Non-goals

- Moving or renaming any existing spec path, including the output-format specs added by `command-status`.
- New commands, flags or output formats; the editor view and the web server come in a later change.
- Supporting Node versions below 22.13 or other runtimes (Deno).
- Changing the MCP server's packaging.
- Replacing the sqlite file-creation behavior with a different strategy; only how the driver is loaded changes.
