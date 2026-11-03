## 1. Warnings for extra properties

- [ ] 1.1 Add failing `variant-config` tests for `parseConfig`: an extra key warns and is dropped, nested and chat renamer keys included; a wrong type, a missing required key and a failed cross-field rule still throw; error and warning together are reported; run the new spec and see it fail
- [ ] 1.2 Implement `parseConfig` in `variant-config` and use it in `readConfigFile`; add `warnings` to `ResolvedConfig`; the tests of 1.1 pass
- [ ] 1.3 Print `warning: ...` lines on stderr once per CLI process and include `warnings` in `variant config` and the MCP `variant_config` result; CLI and MCP tests cover an extra property next to a valid command
- [ ] 1.4 Update the existing tests that expected former or unknown keys to fail (`container`, `env`, `steps`, `storage`, `implode`, `ui`, top-level `seed`, `chatRenamer`, `name`) so they expect a warning; `task test` passes
- [ ] 1.5 Commit the task group

## 2. Port range

- [ ] 2.1 Add failing tests: default range `42000-42999`; a custom range; invalid ranges (`42000`, `42999-42000`, `80-90`, `abc`) fail validation; `reservedPorts` warns; the picker stays inside the range, wraps, skips ports in use, and throws an error naming the range when exhausted; an explicit port outside the range is kept; the UI server and `run-context` pick from the range
- [ ] 2.2 Add `variant.ports.range` to the schema and loader, change `pickFreePort`, `resolveWatchPort` (still named `resolveInstancePort` until group 4), `run-context` and the UI server; delete `reservedPorts`, `DEFAULT_RESERVED_PORTS` and their JSON schema entry; regenerate `variants.yaml.schema.json`; the tests of 2.1 pass
- [ ] 2.3 Commit the task group

## 3. Legacy migration

- [ ] 3.1 Add failing `variant-config` tests: `variant.instances`, `runtime.instances` and `variant.reservedPorts` are read under the current names with one notice each and no unknown-key warning; the new name wins when both exist; `migrateText` keeps comments, order and layout and returns nothing for a current file
- [ ] 3.2 Implement `migrateLegacy`, `migrateText` and the `migrations` field of `ResolvedConfig`; hook them into `readConfigFile` and `readRuntime`; the tests of 3.1 pass (the schema still accepts only current names, so this task lands before the rename in group 4 is finished; write the tests with the target names)
- [ ] 3.3 Add failing tests for `migrateFile`: rewrites a tracked clean `variants.yaml`; skips an untracked file, a file with uncommitted changes, `CI=true` (and not `CI=0`, `CI=false`, empty), `VARIANT_MIGRATE=0`; rewrites a git-ignored `variants.local.yaml`; reports a write failure as a reason; never throws
- [ ] 3.4 Implement `migrateFile` and make the tests pass
- [ ] 3.5 Add failing CLI tests (temporary git repository): output after a rewrite names the file, the change, `git diff` and `git checkout -- <file>`; output when skipped names the reason; the command still runs; once per process and file; `variant-api` and MCP calls leave the file untouched. Implement the CLI part and make them pass
- [ ] 3.6 Add failing extension tests against `mocks/vscode.ts` (add `showWarningMessage` with actions and `showTextDocument` if missing): one warning per file and session with the action **Open file**, the file opens on that action, no second notification, the views still load when the rewrite fails. Implement the extension part and make them pass
- [ ] 3.7 Commit the task group (separate commits for config, CLI and extension when the diff is large)

## 4. Watches: schema and `dir` default

- [ ] 4.1 Add failing tests: `variant.watches` is accepted, a watch without `dir` resolves to its key, a given `dir` wins, an autodetected watch keeps `.`; reserved `variant-ui` and `UI` segment keys and colliding segments still fail
- [ ] 4.2 Rename the schema, loader, autodetection and template code of `variant-config` (`VariantWatch`, `detectWatches`, `resolveWatches`, `resolveWatchPort`, `UI_WATCH_KEY`, messages) and make `dir` optional with the default; regenerate `variants.yaml.schema.json`; the tests of 4.1 and the existing config tests (renamed) pass
- [ ] 4.3 Add failing tests for `runtime.watches` in `variants.local.yaml` (read and write); implement it in `local.ts`; they pass
- [ ] 4.4 Commit the task group

## 5. Watches: library, CLI, MCP, server, UI, extension

- [ ] 5.1 Rename the fields, types and text in `variant-api` (records, status, list, `watch`/`up`/`down`/`implode` reports, runtime state, provisioning, ready, watch operation) with their tests; `task test` for the package passes
- [ ] 5.2 Rename in `variant-cli` text and output tests, `variant-mcp`, `variant-server` (`ui-instance.ts` writes the `variant-ui` watch) and the HTTP API; their tests pass
- [ ] 5.3 Rename in `variant-ui` (model, state, rows, specs) and `variant-vscode` (tree, actions, mocks); component and extension tests pass
- [ ] 5.4 Grep the repository (excluding `openspec/changes/archive`, `node_modules`, `out`, chat renamer window wording, `instanceof`, `toBeInstanceOf`, VS Code decoration types, and the migration code and its tests) for `instance`; no hit remains that means a watch
- [ ] 5.5 Run `task build` and `task test`; both pass
- [ ] 5.6 Commit the task group (split library, interfaces and UI into separate commits when the diff is large)

## 6. Docs and examples

- [ ] 6.1 Add a failing `variant-config` test that loads the fenced `variants.yaml` examples of the READMEs and `docs/` and fails on an error or warning
- [ ] 6.2 Update `README.md`, `packages/variant-vscode/README.md`, `docs/guide/configuration.md`, `core.md`, `library.md`, `mcp.md`, `example/variants.yaml` and `variants.example.yaml` for `watches`, `variant.ports.range` (no reserved ports), the warning rule, the migration (including `VARIANT_MIGRATE` in the variable table) and the current options; `dir` stays in the snippets and the example; `up`, `watch` and `seed` appear only where defined; the test of 6.1 passes and `scripts/docs-coverage.spec.ts` stays green
- [ ] 6.3 Add the `CHANGELOG.md` entries (warnings, `watches` rename marked breaking with the migration note, port range replacing reserved ports, default `dir`, release changelog, unpacked task, Node 24 actions) under `## Unreleased` and the same under the package changelogs they touch
- [ ] 6.4 Commit the task group

## 7. CI, release and packaging

- [ ] 7.1 Bump the pins in all workflows (`checkout@v7`, `upload-artifact@v7`, `download-artifact@v8`, `mise-action@v5`, `upload-pages-artifact@v5`, `deploy-pages@v5`, and the commented `azure/login@v3` line); `task lint:workflows` passes and the feature branch run shows no Node 20 annotation
- [ ] 7.2 Add failing `release-changelog.spec.ts` cases (heading removed for both forms, no `Unreleased` section, empty section, last section) and update the existing expectations; change `promoteUnreleased`; update the `Taskfile.yaml` description and the `CONTRIBUTING.md` release and changelog text; the tests pass
- [ ] 7.3 Change `package-vsix-unpacked.spec.ts` to expect success in the main checkout (unpacks into its own `out/variant-worktrees-main`), drop the `--check` refusal and the Taskfile precondition, update the task description and keep the existing `AIDEV-NOTE`; the test passes and `task package:vsix:unpacked` succeeds in a checkout
- [ ] 7.4 Commit the task group

## 8. Verification

- [ ] 8.1 `openspec validate --all --strict --no-interactive` and `openspec doctor --json` succeed
- [ ] 8.2 `task check:full` succeeds locally
- [ ] 8.3 When syncing the specs, update the Purpose of `variant-config/cfg-runtime` (it still names reserved ports)
