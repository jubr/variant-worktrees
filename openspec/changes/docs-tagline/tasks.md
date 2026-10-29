## 1. Tagline

- [ ] 1.1 Update the expected description in `packages/variant-vscode/src/readme.spec.ts`. Verify the description and both README tagline tests fail.
- [ ] 1.2 Set the new description in `packages/variant-vscode/package.json` and the tagline line of `README.md` and `packages/variant-vscode/README.md`. Verify `bun test packages/variant-vscode/src/readme.spec.ts` passes.

## 2. Validation

- [ ] 2.1 Run `task check:full` and `openspec validate --all --strict --no-interactive`. Verify both exit 0.
