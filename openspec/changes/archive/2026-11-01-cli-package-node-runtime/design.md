## Context

`packages/variant-api` holds the library (`index.ts`, `commands.ts`, operations, db adapters) and, in the same package, the CLI: `cli.ts` (cleye wiring), `cli-args.ts`, `help.ts`, and the output layer `output.ts`, `text.ts`, `table.ts`, `duration.ts` added by `command-status`. Its only Bun-specific code is `db/sqlite.ts` (`bun:sqlite`, plus a `drizzle-orm/bun-sqlite` import whose result is discarded) and `cleanup.ts` (`Bun.Glob`). The build bundles three entry points with `bun build --target node`, so the static `bun:sqlite` import ends up in `dist/index.js` and every consumer of the library, the MCP server included, imports it. `redact.ts` is used by the library (`operations/records.ts`) as well as by the CLI. Release executables are compiled from `packages/variant-api/src/cli.ts` by `scripts/package-cli.ts`. See proposal.md for motivation.

## Goals / Non-Goals

**Goals:**

- The library imports and works on Node 22.13+ and Bun with no Bun-only module reachable at load time.
- The CLI lives in its own package that depends on the library; the library depends on no CLI code.
- No observable change to `variant` commands, flags or output, and none to library results.

**Non-Goals:**

- Moving spec paths, or changing what any command does.
- A runtime abstraction layer beyond the two places that need one.

## Decisions

### Move the whole presentation layer, keep the library's data work

`variant-cli` receives `cli.ts`, `cli-args.ts`, `help.ts`, `output.ts`, `text.ts`, `table.ts` and `duration.ts` with their tests and the `runCli` test helper. `commands.ts` stays in `variant-api` (exported as `variant-api/commands`) because the MCP server derives its tools from the same definitions and the CLI derives its flags from them. `redact.ts` stays, since `status` records redact passwords in the library; `redacted` is added to the public exports so `output.ts` can apply it to every format. `uptime.ts` stays: it is a fact about processes that records carry. The CLI test helper keeps running the CLI from source in a child process.

Alternative: leave the CLI in `variant-api` and only fix the runtime. Rejected: the planned `variant ui` command needs a place above both `variant-api` and a server package, and the library should not carry a parser or renderers.

### One runtime check, loaded lazily, for sqlite

`db/sqlite.ts` stops importing a driver at the top. On the first SQLite operation it picks the driver with `process.versions.bun`: `bun:sqlite` under Bun, `node:sqlite` (`DatabaseSync`) otherwise, using `await import(specifier)` with the specifier in a variable so the bundler leaves it alone. Create opens the file once and closes it, which is all the current adapter does; the unused `drizzle-orm/bun-sqlite` call is removed. A failed import becomes the error the spec names (SQLite, Node 22.13). PostgreSQL and MySQL users never touch either module.

Alternative: write an empty file and skip the driver. Rejected here: it would change what is on disk for a fresh variant (a zero-byte file instead of a file the driver opened), which is outside this change's no-behavior-change boundary.

Alternative: `better-sqlite3`. Rejected: a native dependency in an extension bundle and in compiled executables.

A compiled single-file executable must still create sqlite files; a task builds one and runs it, because a variable-specifier import of a built-in is the part most likely to behave differently there.

### Runtime-neutral glob

`Bun.Glob` is replaced by `tinyglobby` (pure JavaScript, `dot: true`, brace and class support, files only, `cwd`), added as a dependency of `variant-api`. The traversal check that ignores a match outside the worktree and the tracked-file guard are unchanged, so only the matcher moves. Tests cover the same patterns on Node and Bun.

Alternative: `fs.globSync`. Rejected: experimental in Node 22 (it warns on every use) and without brace-expansion guarantees equal to Bun's.

### Package layout and build order

`packages/variant-cli` has `bin: { variant: ./dist/cli.js }`, depends on `variant-api` and `cleye`, and builds with the same `bun build --target node` command shape as `variant-mcp` (externals: `cleye`, `variant-api`, `variant-config`, `yaml`). Root `build` and `test` run `variant-cli` after `variant-api`. `scripts/bun-shebang.sh` and the `bin:bun-shebang` task patch `node_modules/.bin/variant`, which now points at `variant-cli/dist/cli.js`. `scripts/package-cli.ts` compiles `packages/variant-cli/src/cli.ts`; `scripts/release-version.ts` adds `packages/variant-cli/package.json` to the lockstep list, and `version-incr` covers every `packages/*` already. `--version` reads the `variant-cli` manifest.

### Node floor

`engines.node` is `>=22.13.0` on `variant-api` and `variant-cli`: the first Node where `node:sqlite` needs no flag. CI keeps testing with Bun; a Node job runs the library's sqlite and import tests (and the CLI's `--version` and `list`) with the mise-pinned Node so the claim is checked, not assumed.

## Risks / Trade-offs

- [Users who installed `variant-api` for its `variant` bin lose the command] → Marked breaking in the proposal, CHANGELOG, README and the installation guide; `npm install -g variant-cli` and the release executables replace it.
- [The variable-specifier import breaks in compiled executables or in the bundler] → A task compiles the executable and runs a sqlite `create` and `list`; the fallback is `--external bun:sqlite` plus a static import split into two files.
- [`tinyglobby` and Bun's glob differ on an edge pattern] → The scenarios in the spec fix the supported syntax; both runtimes run the same test files.
- [Moving files breaks open work] → The move is `git mv` with history, in one commit per task group, and imports are rewritten mechanically; other open changes touch `cli.ts` only through `command-status`, which this change stacks on.
- [Output specs live under `variant-api/` while the code moves] → Accepted; capability paths name behavior domains, not packages, and renaming them is a separate documentation move.

## Migration Plan

Merge after `command-status`. Publish `variant-cli` with the release (same lockstep version); users of the bin switch packages or use the release executable. Rollback is a revert of the move commits: no data or state format changes.
