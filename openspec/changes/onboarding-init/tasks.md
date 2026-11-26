## 1. Init writes a minimal, final `variants.yaml`

- [ ] 1.1 Red then green in `packages/variant-config/src/init-config.spec.ts`: with nothing detected the text has no `db` key and loads to SQLite; with Postgres detected it still has `db`; `detected.dialect` stays `sqlite`. Verify `bun test` of `variant-config` passes.
- [ ] 1.2 Red then green in the same spec: the text starts with `schemaHeaderFor("variants.yaml")`, a blank line, then the "Written by" comment, and `migrateFile` on it returns nothing. Verify the spec passes.
- [ ] 1.3 Round trip in `packages/variant-api/src/operations/init.spec.ts`: after `initProject` in a directory with no database, the written file has no `db` and no `variants.yaml~` exists after `migrateFile`. Verify the spec passes.
- [ ] 1.4 Task-group commit (`fix(init): ...`) with the code and tests of 1.1 to 1.3.

## 2. Mise step adds the `packslip:` tool

- [ ] 2.1 Red then green in `packages/variant-api/src/mise-augment.spec.ts`: created and appended entries are `"packslip:jubr/variant-worktrees" = "latest"`; a file listing `packslip:` or `github:` is unchanged and reported as listed. Verify the spec passes.
- [ ] 2.2 Update the expectations of `operations/init.spec.ts` (`github:jubr` becomes `packslip:jubr`) and the MCP and CLI specs that read the mise line. Verify `bun test` of `variant-api`, `variant-cli` and `variant-mcp` passes.
- [ ] 2.3 Task-group commit (`feat(init): ...`).

## 3. Editor actions read the current configuration

- [ ] 3.1 Red then green in `packages/variant-vscode/src/variants-client.spec.ts` (create it if missing, with the mock of `variant-api`): a second `loadClient()` after `variants.yaml` changed creates a new client; after no change it returns the cached one; a created file (was `none`) counts as changed. Verify the spec passes.
- [ ] 3.2 High-level spec in `variants-view.spec.ts`: play on `main` before and after a watch is added to `variants.yaml` starts the watch the second time. Verify the spec passes.
- [ ] 3.3 Task-group commit (`fix(vscode): ...`).

## 4. Docs, changelog and gates

- [ ] 4.1 Update `README.md` (init paragraph), `docs/guide/commands.md` (`variant init`), `docs/guide/installation.md` (output with the `packslip:` mise line, the header, and the `db`-less example) and `CHANGELOG.md` under Unreleased. Verify `task check:full` docs build passes and `scripts/docs-site.spec.ts` is green.
- [ ] 4.2 `openspec validate --all --strict --no-interactive` passes, `task check:all` passes, and `task bleed:cli` publishes the binary. Show in chat `variant init` in an empty temp directory: no `db` key, header first, `packslip:` in `mise.toml`, and a following `variant list` without a migration message.
