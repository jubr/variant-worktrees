## 1. Command sections in code

- [ ] 1.1 Test (`commands.spec.ts`): every registered command has `section` `basic` or `lifecycle` as specified; `COMMAND_SECTIONS` is `basic`, `lifecycle`, `cli`; the CLI-only commands map to `cli`
- [ ] 1.2 Add `CommandSection`, `COMMAND_SECTIONS` and `section` to `CommandDefinition` and every entry of `commands.ts`, with a comment saying where each section is documented
- [ ] 1.3 Map `CLI_ONLY_COMMANDS` to section `cli` in `packages/variant-cli/src/commands/index.ts`

## 2. Docs tests first (red)

- [ ] 2.1 `docs-coverage.spec.ts`: Commands page has ``### `variant <name>` `` for every registered command; the CLI page has no *MCP server* heading; the `variant mcp` test reads ``### `variant mcp` ``
- [ ] 2.2 `docs-site.spec.ts`: Commands sections and headings follow the `section` tags; the CLI page heading structure, lifecycle intro text, deep-link lists and CLI-only headings
- [ ] 2.3 `docs-site.spec.ts`: Overview and MCP-tool link text and targets; no bare command anchors in `docs/` and `README.md`; link text equals the target heading for every link into Commands and CLI-only commands
- [ ] 2.4 `docs-site.spec.ts`: an `hr.option-sep` precedes every option heading of the Configuration page except the first of each section; the stylesheet rules

## 3. Commands page

- [ ] 3.1 Rewrite the intro of `docs/guide/commands.md` and add the sections *Basic commands* (`init`, `config`, `list`, `status`), and *Lifecycle commands*; the intro points to the CLI page for `ui`, `mcp` and `completions`
- [ ] 3.2 Rename every command heading to ``### `variant <name>` ``; move `ui` out; update the links inside the page to ``[`variant <name>`](#variant-<name>)``

## 4. CLI page

- [ ] 4.1 Add *Basic commands* and *Lifecycle commands* (links only, no intro text) to `docs/guide/cli.md`
- [ ] 4.2 Add last *CLI-only commands* with ``### `variant mcp` `` (from *MCP server*), ``### `variant ui` `` (from Commands) and ``### `variant completions` `` (from *Completions*); drop the old sections and fix the page intro

## 5. Links

- [ ] 5.1 Rewrite links to commands in `overview.md`, `installation.md`, `runtime.md`, `workspace.md`, `configuration.md`, `vscode/mcp.md`, `vscode/extension.md`, `development/library.md`, `README.md` and `CHANGELOG.md` to ``[`variant <name>`](…#variant-<name>)``
- [ ] 5.2 Update the `cli#mcp-server` and `cli#completions` links

## 6. Configuration separators

- [ ] 6.1 Add `<hr class="option-sep">` before each option heading in `docs/guide/configuration.md`
- [ ] 6.2 Add the `hr.option-sep` and following-heading rules to `docs/.vitepress/theme/custom.css`

## 7. Docs of the docs

- [ ] 7.1 `CONTRIBUTING.md`: a new command is a ``### `variant <name>` `` section of `docs/guide/commands.md`, or of `docs/guide/cli.md` when its `section` is `cli`, and carries a `section` tag
- [ ] 7.2 `CHANGELOG.md` *Unreleased*: the renamed anchors (BREAKING, docs URLs) and the `section` tag

## 8. Verify

- [ ] 8.1 `task docs:build`, `task check:full`, `openspec validate --all --strict --no-interactive`
- [ ] 8.2 Look at the built Commands, CLI and Configuration pages in the browser
