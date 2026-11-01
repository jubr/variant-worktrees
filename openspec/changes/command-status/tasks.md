## 1. Output formats and global flags

- [ ] 1.1 Add failing CLI tests for text default, `--json`, `--yaml`, flag before/after the command, `--json --yaml` conflict, exit code kept and password redaction; verify they fail, then implement `src/output.ts` and the flag extraction in `src/cli.ts` and verify `bun test` passes for them
- [ ] 1.2 Make `variant list` print the table by default, remove `--table`, and verify the updated list tests (table default, `--json` array, `--table` rejected) pass
- [ ] 1.3 Add text renderers for `config`, `create`, `provision`, `up`, `watch`, `down` and `implode` with the generic outline fallback, and verify a test that runs each command without a flag and sees non-JSON, non-empty text
- [ ] 1.4 Add the `Global flags` help section (top level and per command, `--help` removed from `Flags`) and verify with tests on `variant --help` and `variant watch --help`

## 2. Status command

- [ ] 2.1 Add failing library tests for `client.status` (running variant, worktree-derived slug, unknown slug, one variant only, no runtime state), then implement `operations/status.ts` with helpers shared with `list.ts` and verify they pass
- [ ] 2.2 Add failing tests for runtime meta (`runtime.file/mode/dir/db/instances`, `alive`, env override, password redacted), then implement and verify they pass
- [ ] 2.3 Register `status` in `commands.ts` and `VariantClient` types and `index.ts`, add its text layout, and verify `variant status <slug>` text, `--json` and `--yaml` in CLI tests
- [ ] 2.4 Add an MCP test for `variant_status` (known slug, unknown slug) and verify `bun test` in `variant-mcp` passes

## 3. Documentation and contributing

- [ ] 3.1 Add the requirement to `CONTRIBUTING.md` that every added command or functionality is also added to the README and to `docs/`, and verify the text is present under a relevant heading
- [ ] 3.2 Update `README.md` CLI section: add `status`, a "Global flags" subsection for `--json` and `--yaml`, and the MCP tools list; verify with a README test or grep that `variant status`, `--json`, `--yaml` appear and the flags subsection is separate
- [ ] 3.3 Update `docs/guide/core.md` (status, output formats, global flags), `docs/mcp.md` (`variant_status`) and `CHANGELOG.md` (Added: status, `--json`, `--yaml`; **BREAKING**: text default, `--table` removed), and verify `task docs:build` succeeds if available
- [ ] 3.4 Run `task lint`, `task test`, `task build`, `openspec validate --all --strict --no-interactive` and verify all pass
