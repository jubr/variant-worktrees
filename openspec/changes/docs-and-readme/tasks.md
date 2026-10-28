## 1. Contract test (red)

- [ ] 1.1 Add `packages/variant-vscode/src/readme.spec.ts` covering every scenario of `docs/readmes` (description, docs link before the first `##`, `Why` first and before `variant watch`, no development strings in the extension README, product areas present, `mise use` line and `CONTRIBUTING.md` link in the repository README). Verify `task test` fails on the new spec.

## 2. Extension description and README

- [ ] 2.1 Set `description` to `Git + Db schema :: provision, watch, implode` in `packages/variant-vscode/package.json`. Verify the description scenario passes.
- [ ] 2.2 Rewrite `packages/variant-vscode/README.md` per design.md: docs link, `Why`, `How it works`, configuration, MCP, chat renamer, learn more; no development or probe content. Verify the extension README scenarios pass and the `.vsix` build still includes `README.md`.

## 3. Repository README

- [ ] 3.1 Rewrite the top of `README.md`: icon, docs link, `Why`, `How it works`, install with `mise use github:jubr/variant-worktrees`. Keep Configuration, CLI, MCP, Chat renamer, and Packages, and reduce the source-build and Development sections to a pointer to `CONTRIBUTING.md`. Verify the repository README scenarios and the existing icon test pass.

## 4. CLI version

- [x] 4.1 Add a `cli.test.ts` case for `variant --version` and the `--help` header, then read the version from `package.json` in `packages/variant-api/src/cli.ts`. Verify `bun test test/cli.test.ts` passes and the compiled executable from `task package:cli` prints the package version.

## 5. Validation

- [ ] 5.1 Run `task check:full` and `openspec validate --all --strict --no-interactive`. Verify both exit 0.
