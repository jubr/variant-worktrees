## Context

See proposal.md for why. Today `packages/variant-mcp/src/mcp.ts` is a script: importing it parses `process.argv`, loads configuration, registers the tools and connects the stdio transport. Three things import or run it: the package bin (`variant-mcp`), `scripts/bleed.ts` (compiles it to a single-file executable), and the extension's `mcp-entry.ts` (`await import("variant-mcp/bundle")` after handling `--cwd`). `packages/variant-api/src/commands.spec.ts` also resolves `variant-mcp/bundle`.

`variant-cli` (`src/cli.ts`) is a cleye program. Its `ui` command is CLI-only (`CLI_ONLY_COMMANDS`), and `scripts/build-cli.ts` bundles `variant-server` into `dist/cli.js` as a dev dependency. Before any command runs, `cli.ts` strips `-C`, `--log-level`, `--json` and `--yaml`, attaches a CLI log sink (stderr plus the editor socket, origin `cli`), and logs lifecycle commands.

`help.ts` renders cleye's help tables. cleye's table renderer pads every row to the full terminal width.

## Goals / Non-Goals

**Goals:**

- `variant mcp [--config <path>]` is the one way to start the standalone server, from source, `dist/cli.js` and compiled executables.
- The tools, results and logging notifications stay byte-for-byte what `variant-mcp` produced.
- No help line has trailing whitespace.

**Non-Goals:**

- No new tools, no change to tool arguments, no change to the extension registration (command, `--cwd`, `ELECTRON_RUN_AS_NODE`).
- No deprecation shim: no `variant-mcp` executable stays behind, not even one that prints a hint.
- No change to the layout of cleye's stacked (narrow) help.

## Decisions

**1. `variant-mcp` exports a start function; nothing runs on import.** `mcp.ts` becomes `runMcpServer({ args, version, cwd? })`, returning when the transport is connected (the process then stays alive through the open stdin, as now). Option parsing (`--config`, strict) stays in the library so both callers share it. The `--internal-watch-relay` branch moves out of the library into both entry points: `cli.ts` already has it, and `mcp-entry.ts` gets it (the extension's bundled script is the process the relay re-launches there). Alternative: leave `mcp.ts` as a script and spawn it from `variant mcp`. Rejected: it needs a second file next to a compiled executable, which is what this change removes.

**2. The version comes from the caller.** The library no longer reads `../package.json` (the bleed script rewrites that line today). `variant mcp` passes the CLI's version; `mcp-entry.ts` passes the extension's `package.json` version, which is the shared release version. That deletes the `embed-mcp-version` Bun plugin in `scripts/bleed.ts` together with `compileMcp`.

**3. `variant-cli` bundles `variant-mcp` and loads it lazily.** `variant-mcp` becomes a `devDependency` of `variant-cli`, like `variant-server`, and is not in the `external` list of `scripts/build-cli.ts`, so `@modelcontextprotocol/sdk` and `zod` end up in `dist/cli.js` and in the compiled executables. The `mcp` command handler calls `await import("variant-mcp")` so other commands do not evaluate the SDK at startup. Alternative: make the SDK a runtime dependency of `variant-cli` and mark it external. Rejected: the compiled executables bundle everything anyway, and the npm package should keep one self-contained file as it does for the UI server. The `variant-mcp` package keeps its name and its workspace role, loses `bin`, `mcp:inspect` runs `variant mcp`, and its `exports` point at the start function.

**4. The MCP log sink wins over the CLI sink.** `runMcpServer` installs its own sink (MCP notifications plus editor delivery with origin `mcp`) with `setLogSink`, so the CLI sink attached early in `cli.ts` is replaced. For `mcp`, `cli.ts` skips `attachLogLevel` and the lifecycle info line, and does not print the `[debug] cli end` line, so the `cli` origin and `ipc`/`cli` steps never appear for a server run. `--log-level` is stripped and has no effect; MCP clients choose the level with `logging/setLevel`.

**5. Standard output belongs to the protocol.** The `mcp` branch of `cli.ts` runs before anything that can write to stdout: no `console.log`, no `printWarnings` on stdout. Configuration warnings the server collects keep their current route (they are not on stdout today). A test starts `variant mcp` as a subprocess, sends `initialize` and `tools/list`, and checks every stdout line is JSON-RPC.

**6. `mcp` is a CLI-only command, not a library command.** It is added to `CLI_ONLY_COMMANDS` next to `ui` and to the completion generator's command list, with its own cleye command (flag `--config`), because the library's `commands` list is also the source of the MCP tools, and an MCP tool that starts an MCP server makes no sense.

**7. Trailing whitespace is trimmed after rendering, not by changing cleye's layout.** `renderHelp` already post-processes cleye's nodes; it now also trims `[ \t]+` at the end of every line of the rendered string (before any trailing ANSI reset sequence, which is kept). Root cause, found by running `variant watch --help` in GNU screen at 80 columns: each table row is padded to exactly the terminal width and followed by a newline; screen wraps at the last column and the newline then adds a second line break, an empty line between every row. Alternatives: only trim in the `Global flags` section (rejected: the `Flags` section of the same help has the same problem), or ask cleye for narrower tables (rejected: depends on cleye internals and a width guess).

**8. Bleeds and release.** `bleed:mcp`, `publishMcp`, `compileMcp`, the `bleed:all` step and their tests are removed. Proof that the bled binary serves MCP is part of the `bleed:cli` delivery check: pipe `initialize` and `tools/list` into `vw-bleeds/variant-cli/bin/variant mcp` and show the tool names. The release workflow needs no change: it builds `variant` only.

**9. Mise tool.** `mise.toml` `[tools]` gets `"packslip:jubr/variant-worktrees" = "latest"`. It is tooling for this repository, outside the specs.

## Risks / Trade-offs

- [`variant-cli` bundle grows by the MCP SDK and zod] → lazy import keeps startup of other commands unchanged; `variant --version` and `variant list` are timed before and after in the tasks.
- [Existing `mcp.json` files that run `variant-mcp` break] → **BREAKING** entry in `CHANGELOG.md` with the replacement configuration; the extension registers `dist/mcp.mjs` itself and is not affected.
- [The `variant-mcp` bin was a published npm bin; consumers of the package lose it] → the package was only a workspace library plus bin; the replacement is documented, and the version stays `0.0.x`.
- [A `[ \t]+$` trim could cut meaningful spaces] → help text has none that matter; a test compares the help text to itself with trailing spaces removed per line, in text and on a terminal.
- [The screen fix cannot be proved by `bun test` alone] → the spec scenario is covered by a spec that runs the help in a pseudo terminal (as `help.spec.ts` does already) and asserts no line ends in whitespace; the screen run is repeated by hand as the last delivery step.
- [`setLogSink` order] → a CLI test asserts that no `[debug] cli end` or `ipc` line reaches stderr for `variant mcp`.

## Migration Plan

1. Land code, docs and specs on this branch; `task check:full` and `task bleed:cli` green.
2. Users: replace `"command": "variant-mcp"` with `"command": "variant", "args": ["mcp"]`; `mise use github:jubr/variant-worktrees` already provides `variant`.
3. Rollback: revert the commit; the previous `variant-mcp` bin returns with it.
4. Local clean-up (not automated): remove `vw-bleeds/variant-mcp` and any `mcp.json` entry that points at it.
