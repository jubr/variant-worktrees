## 1. Rename the example scripts

- [ ] 1.1 Update `example-project.spec.ts` to expect `server:watch` in `example/be` with `--no-clear-screen`, plus `app:watch` in `example/fe` and no `dev`/`start:dev`; verify the new test fails
- [ ] 1.2 Rename `dev` to `app:watch` in `example/fe/package.json` and `start:dev` to `server:watch` in `example/be/package.json`; verify the test from 1.1 passes
- [ ] 1.3 Point both watches of `example/variants.yaml` at `bun run server:watch` and `bun run app:watch`, and update `example/README.md`; verify a repo search for `bun run dev` and `start:dev` under `example/` finds nothing

## 2. Root variants.yaml

- [ ] 2.1 Add a failing test in `example-project.spec.ts` that loads the root `variants.yaml` and asserts its schema validity, the `PORT`/`VARIANT_API_PORT` overrides and the watch commands of `be` and `fe`, and that `example/variants.yaml` uses the same commands
- [ ] 2.2 Update the root `variants.yaml`: `PORT: '${port}'` on both watches, `VARIANT_API_PORT: '${be.port}'` and `ready` on `fe`, `ready` on `be`, commands `bun run server:watch` and `bun run app:watch`; verify the test from 2.1 passes
- [ ] 2.3 Run `variant watch --detach` for a throwaway variant and verify both watches become ready on distinct ports, then `variant down`

## 3. Docs and gates

- [ ] 3.1 Add a `CHANGELOG.md` entry for the renamed example scripts; verify no other doc under `docs/`, `README.md` or `packages/*/README.md` names the example's old scripts
- [ ] 3.2 Verify `openspec validate --all --strict --no-interactive` and `task check:all` pass
