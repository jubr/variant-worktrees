## 1. Help without trailing padding

- [ ] 1.1 Add failing tests in `packages/variant-cli/src/help.spec.ts`: no line of `variant --help` and `variant watch --help` ends in a space or tab (non-terminal and pseudo terminal at 50, 80 and 120 columns); the test fails before the change
- [ ] 1.2 Trim trailing spaces and tabs per line in `renderHelp` (`packages/variant-cli/src/help.ts`), keeping a trailing ANSI reset; verify 1.1 and the existing global-flag spacing tests pass
- [ ] 1.3 Verify by hand in GNU screen (80 columns): `variant watch --help` shows no empty line between the `Global flags` rows; paste the result in the PR

## 2. MCP server as a library

- [ ] 2.1 Add failing tests in `packages/variant-mcp/src/mcp.spec.ts` that call the exported start function with `args`, `version` and `cwd` (`--config` honored, unknown option rejected) and import it without side effects
- [ ] 2.2 Turn `packages/variant-mcp/src/mcp.ts` into `runMcpServer`, remove the top-level run, the `--internal-watch-relay` branch and the `package.json` version read; verify the existing MCP tests pass against the function
- [ ] 2.3 Remove `bin` and the `dist/mcp.js` shebang use from `packages/variant-mcp/package.json`, point `mcp:inspect` at `variant mcp`, and verify a spec reads the manifest and finds no `bin` (`variant-vscode` `mcp-entry.spec.ts` updated from `{ "variant-mcp": ... }`)
- [ ] 2.4 Update `packages/variant-vscode/src/mcp-entry.ts` to handle `--internal-watch-relay`, then call `runMcpServer` with the extension version; verify `mcp-entry.spec.ts` (tools list has `variant_list`, no `variant_destroy`, `--cwd` works) and `commands.spec.ts` in `variant-api` pass

## 3. variant mcp command

- [ ] 3.1 Add failing CLI tests (`packages/variant-cli/src/mcp.spec.ts`): subprocess `variant mcp` answers `initialize` and `tools/list` with `variant_list`, no `variant_destroy`; every stdout line is JSON-RPC; `--config` and `-C` pick the configuration; `--nope` exits non-zero with nothing on stdout; `--json` does not change the server; no `[debug] cli end` or `ipc` line on stderr
- [ ] 3.2 Add the `mcp` command (cleye, flag `--config`) in `packages/variant-cli/src/mcp.ts`, add it to `CLI_ONLY_COMMANDS`, skip the CLI log sink, lifecycle info line and `cli end` for it, and load `variant-mcp` lazily; verify 3.1 passes
- [ ] 3.3 Add `variant-mcp` as a `devDependency` of `variant-cli`, keep it out of `external` in `scripts/build-cli.ts`, and verify `task build` produces a `dist/cli.js` whose `node dist/cli.js mcp` lists the tools with no `node_modules` of the SDK next to it
- [ ] 3.4 Add `mcp` to help command listing and to the completion scripts; verify `completions*.spec.ts` and the `help` tests name `mcp`, and `variant mcp --help` lists `--config`
- [ ] 3.5 Time `variant --version` and `variant list --help` before and after; verify no measurable startup regression (the lazy import holds)

## 4. Remove the separate executable

- [ ] 4.1 Remove `bleed:mcp` from `Taskfile.yaml`, `bleed:all` runs `bleed:vsix` then `bleed:cli`; verify with `task --list` (no `bleed:mcp`)
- [ ] 4.2 Remove `publishMcp`, `compileMcp`, `bleedMcp` and the `mcp` subcommand from `scripts/bleed.ts` and their tests from `scripts/bleed.spec.ts`; verify `bun test scripts` passes
- [ ] 4.3 Add a manifest spec: `bin` of `variant-api`, `variant-cli`, `variant-server` and `variant-mcp` together is only `variant`; verify it passes

## 5. Docs, changelog, tooling

- [ ] 5.1 Update `README.md` (CLI section lists `mcp`; MCP client configuration uses `variant` + `["mcp"]`), `docs/guide/commands.md` (section `mcp`), `docs/vscode/mcp.md`, `docs/development/building.md` (run `variant mcp` or `node packages/variant-cli/dist/cli.js mcp`), `packages/variant-vscode/README.md`, `AGENTS.md`; verify `packages/variant-vscode/src/test/readme.spec.ts` (now `variant mcp`), `scripts/docs-site.spec.ts` and the docs build pass, and `rg "variant-mcp" README.md docs packages/variant-vscode/README.md` finds no executable name
- [ ] 5.2 Record the **BREAKING** removal of the `variant-mcp` executable, the new `variant mcp` and the help fix under `## Unreleased` in `CHANGELOG.md`; verify with `task check:all` changelog-related checks
- [ ] 5.3 Add `"packslip:jubr/variant-worktrees" = "latest"` to `[tools]` of `mise.toml`; verify `mise ls --current --json` runs without a config error (the tool itself may need `mise install`)
- [ ] 5.4 Update the Purpose line of `openspec/specs/meta/dev-bleeds/spec.md` (mentions the MCP server) directly at sync time; verify `openspec validate --all --strict --no-interactive`

## 6. Verification

- [ ] 6.1 `task check:full` is green; `openspec validate variant-mcp-as-cmd --strict --no-interactive` and `openspec validate --all --strict --no-interactive` pass
- [ ] 6.2 Run `task bleed:cli`, then in chat show the command and its output: `printf '%s\n' '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"t","version":"0"}}}' '{"jsonrpc":"2.0","method":"notifications/initialized"}' '{"jsonrpc":"2.0","id":2,"method":"tools/list"}' | ../vw-bleeds/variant-cli/bin/variant mcp` listing the `variant_*` tools
