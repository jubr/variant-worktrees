## 1. Runtime facts: log, uptime

- [ ] 1.1 Add `runtime.log` to the `variant-config` schema, `variants.local.yaml.schema.json` and `variants.local.example.yaml`; write the failing read/validate/example-in-sync tests first and verify `bun test` in `variant-config` passes
- [ ] 1.2 Write a failing test that a detached `watch` writes process output to `variants.watch.log` in real time (two processes, header lines, truncation on restart) and records `runtime.log`; implement and verify it passes, and verify an attached watch writes no file
- [ ] 1.3 Write a failing test that `down` drops `runtime.log` and keeps the file; implement and verify it passes
- [ ] 1.4 Add `src/uptime.ts` (`ps -o etime=` parsing for `ss`, `mm:ss`, `hh:mm:ss`, `dd-hh:mm:ss`; missing process gives nothing) with unit tests, and verify they pass

## 2. Output formats and global flags

- [ ] 2.1 Add failing CLI tests for text default, `--json`, `--yaml`, flag before/after the command, `--json --yaml` conflict, exit code kept and password redaction; verify they fail, then implement `src/output.ts` and the flag extraction in `src/cli.ts` and verify `bun test` passes for them
- [ ] 2.2 Add text renderers for `config`, `create`, `provision`, `up`, `watch`, `down` and `implode` with the generic outline fallback, and verify a test that runs each command without a flag and sees non-JSON, non-empty text
- [ ] 2.3 Add the `Global flags` help section (top level and per command, `--help` removed from `Flags`) and verify with tests on `variant --help` and `variant watch --help`
- [ ] 2.4 Add `-v` as the short alias of `--verbose` on every command and verify `variant list -v` passes `{ verbose: true }` and `variant --version` still prints the version

## 3. Status and list

- [ ] 3.1 Add failing library tests for `client.status` (running variant, worktree-derived slug, unknown slug, one variant only, no runtime state), then implement `operations/status.ts` on a record builder shared with `list.ts` and verify they pass
- [ ] 3.2 Add failing tests for runtime meta (`runtime.file/mode/dir/log/db/instances`, `alive`, env override, password redacted) and for `uptimeSeconds`/`log` on records (longest process wins, dead pid has none, `up` has none), then implement and verify they pass
- [ ] 3.3 Register `status` in `commands.ts`, `VariantClient` types and `index.ts`, add its text layout (uptime, log, runtime block), and verify `variant status <slug>` text, `--json` and `--yaml` in CLI tests
- [ ] 3.4 Make `variant list` print the table `slug, mode, uptime, url, log, dir` with the full URL, remove `--table`, and verify list tests (columns, `-` for missing, URL never shortened, `--json` records, `--table` rejected)
- [ ] 3.5 Add `list --verbose`: records equal `status` per slug, text prints status blocks; verify with tests for `--verbose --json` equality, `-v` text and minimal records without `runtime`
- [ ] 3.6 Add an MCP test for `variant_status` (known, unknown slug) and `variant_list({ verbose: true })` and verify `bun test` in `variant-mcp` passes

## 4. Documentation and contributing

- [ ] 4.1 Add the requirement to `CONTRIBUTING.md` that every added command or functionality is also added to the README and to `docs/`, and verify the text is present under a relevant heading
- [ ] 4.2 Update `README.md` CLI section: `status`, `list -v`, the minimal list columns, the watch log file, a "Global flags" subsection for `--json` and `--yaml`, and the MCP tools list; verify with a README test or grep that `variant status`, `--json`, `--yaml` appear and the flags subsection is separate
- [ ] 4.3 Update `docs/guide/core.md` (status, list columns and `-v`, watch log, output formats, global flags), `docs/guide/configuration.md` (`runtime.log`), `docs/mcp.md` (`variant_status`, `variant_list` verbose) and `CHANGELOG.md` (Added: status, `--json`, `--yaml`, `-v`, watch log, uptime; **BREAKING**: text default, `--table` removed, new list columns), and verify `task docs:build` succeeds if available
- [ ] 4.4 Run `task lint`, `task test`, `task build`, `openspec validate --all --strict --no-interactive` and verify all pass
