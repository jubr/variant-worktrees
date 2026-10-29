## 1. Command, operation, and client

- [ ] 1.1 Update `packages/variant-api/test/commands.test.ts` and `packages/variant-mcp/test/mcp.test.ts` to drop `switch` / `variant_switch` and assert both are absent; verify they fail before the code change (red)
- [ ] 1.2 Remove the `switch` definition from `packages/variant-api/src/commands.ts`, `switch` from `VariantClient` in `types.ts`, the client method in `index.ts`, and delete `operations/switch.ts`; verify `task test` passes for `variant-api` and `variant-mcp`
- [ ] 1.3 Remove the `switches to the primary worktree for main` test from `test/operations.test.ts` and verify it no longer runs
- [ ] 1.4 Add a test that `create` leaves `process.cwd()` unchanged when it creates a worktree; verify it passes
- [ ] 1.5 Remove `switchWorktree` from `worktree.ts` and the `index.ts` export; verify `task build` and `task lint` pass

## 2. Extension

- [ ] 2.1 Remove `"switch"` from the lifecycle set in `packages/variant-vscode/src/extension.ts`; verify the extension tests and `task build` pass

## 3. Docs and specs

- [ ] 3.1 Remove `switch` from `README.md`, `AGENTS.md`, `docs/mcp.md`, `docs/cli-vscode-webview.md`, `docs/guide/core.md`, `docs/guide/ipc.md`, and `docs/guide/library.md`; verify `task docs:build` (or the docs spec tests) pass
- [ ] 3.2 Add a `Removed` entry for the `switch` command (breaking) to `CHANGELOG.md`; verify the entry sits under an `Unreleased` heading
- [ ] 3.3 Verify `rg -i 'switch'` outside `openspec/changes/archive/`, `node_modules`, and unrelated uses (JS `switch`, git `switch`, "switched off", appearance switch) returns no reference to the command

## 4. Verification

- [ ] 4.1 Run `task check:full` and `openspec validate --all --strict --no-interactive` and verify both pass
