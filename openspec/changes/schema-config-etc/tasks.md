## 1. Warnings for extra properties

- [ ] 1.1 Add failing `variant-config` tests for `parseConfig`: an extra key warns and is dropped, nested and chat renamer keys included; a wrong type, a missing required key and a failed cross-field rule still throw; error and warning together are reported; run `task test` filtered to the new spec and see it fail
- [ ] 1.2 Implement `parseConfig` in `variant-config` and use it in `readConfigFile`; add `warnings` to `ResolvedConfig`; the tests of 1.1 pass
- [ ] 1.3 Print `warning: ...` lines on stderr once per CLI process and include `warnings` in `variant config` and the MCP `variant_config` result; CLI and MCP tests cover an extra property next to a valid command
- [ ] 1.4 Update the scenarios that expected former or unknown keys to fail (`container`, `env`, `steps`, `storage`, `implode`, `ui`, top-level `seed`, `chatRenamer`, `name`) in the existing tests so they expect a warning; `task test` passes
- [ ] 1.5 Commit the task group (tests and code)

## 2. Watches: schema and `dir` default

- [ ] 2.1 Add failing tests: `variant.watches` is accepted, `variant.instances` warns, a watch without `dir` resolves to its key, a given `dir` wins, an autodetected watch keeps `.`; reserved `variant-ui` and `UI` segment keys and colliding segments still fail
- [ ] 2.2 Rename the schema, loader, autodetection and template code of `variant-config` (`VariantWatch`, `detectWatches`, `resolveWatches`, `UI_WATCH_KEY`, messages) and make `dir` optional with the default; regenerate `variants.yaml.schema.json`; the tests of 2.1 and the existing config tests (renamed) pass
- [ ] 2.3 Add failing tests for `runtime.watches` in `variants.local.yaml`, the legacy `runtime.instances` read, and rewrite on write; implement it in `local.ts`; they pass
- [ ] 2.4 Commit the task group

## 3. Watches: library, CLI, MCP, server, UI, extension

- [ ] 3.1 Rename the fields, types and text in `variant-api` (records, status, list, `watch`/`up`/`down`/`implode` reports, runtime state, provisioning, ready, watch operation) with their tests; `task test` for the package passes
- [ ] 3.2 Rename in `variant-cli` text and output tests, `variant-mcp`, `variant-server` (`ui-instance.ts` writes the `variant-ui` watch) and the HTTP API; their tests pass
- [ ] 3.3 Rename in `variant-ui` (model, state, rows, specs) and `variant-vscode` (tree, actions, mocks); component and extension tests pass
- [ ] 3.4 Grep the repository (excluding `openspec/changes/archive`, `node_modules`, `out`, chat renamer window wording, `instanceof`, `toBeInstanceOf`, VS Code decoration types) for `instance`; no hit remains that means a watch
- [ ] 3.5 Run `task build` and `task test`; both pass
- [ ] 3.6 Commit the task group (split library, interfaces and UI into separate commits when the diff is large)

## 4. Docs and examples

- [ ] 4.1 Add a failing `variant-config` test that loads the fenced `variants.yaml` examples of the READMEs and `docs/` and fails on an error or warning
- [ ] 4.2 Update `README.md`, `packages/variant-vscode/README.md`, `docs/guide/configuration.md`, `core.md`, `library.md`, `mcp.md`, `example/variants.yaml` and `variants.example.yaml` for `watches`, the default `dir`, the warning rule and the current options; `up`, `watch` and `seed` appear only where defined; the test of 4.1 passes and `scripts/docs-coverage.spec.ts` stays green
- [ ] 4.3 Add the `CHANGELOG.md` entries (warnings, `watches` rename marked breaking with the `runtime.instances` read note, default `dir`, release changelog, unpacked task, Node 24 actions) under `## Unreleased` and the same under the package changelogs they touch
- [ ] 4.4 Commit the task group

## 5. CI, release and packaging

- [ ] 5.1 Add a failing `scripts` test that reads `.github/workflows/*` and fails for an action below its Node 24 minimum major; bump the pins in all workflows (and the commented `azure/login` line); the test passes and `task lint:workflows` passes
- [ ] 5.2 Add failing `release-changelog.spec.ts` cases (heading removed for both forms, no `Unreleased` section, empty section, last section) and update the existing expectations; change `promoteUnreleased`; update the `Taskfile.yaml` description and the `CONTRIBUTING.md` release and changelog text; the tests pass
- [ ] 5.3 Change `package-vsix-unpacked.spec.ts` to expect success in the main checkout (unpacks into its own `out/variant-worktrees-main`), drop the `--check` refusal and the Taskfile precondition, update the task description and keep the existing `AIDEV-NOTE`; the test passes and `task package:vsix:unpacked` succeeds in a checkout
- [ ] 5.4 Commit the task group

## 6. Verification

- [ ] 6.1 `openspec validate --all --strict --no-interactive` and `openspec doctor --json` succeed
- [ ] 6.2 `task check:full` succeeds locally
