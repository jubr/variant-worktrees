## 1. Example scripts

- [ ] 1.1 Add `server:watch` to `example/be/package.json` (build, then `bun --watch --no-clear-screen src/main.ts`) and verify `bun run server:watch` in `example/be` builds and serves `/api` on `PORT`
- [ ] 1.2 Add `app:watch` to `example/fe/package.json` (build, then the Vite dev server) and verify `bun run app:watch` in `example/fe` builds and serves on `PORT`

## 2. Root variants.yaml

- [ ] 2.1 Write a failing test next to the `variant-config` example-project spec that loads the root `variants.yaml` and asserts the ports, commands and schema validity of `be` and `fe`
- [ ] 2.2 Update the root `variants.yaml`: `PORT: '${port}'` on both watches, `VARIANT_API_PORT: '${be.port}'` and `ready` on `fe`, `watch` commands `bun run server:watch` and `bun run app:watch`; verify the test from 2.1 passes
- [ ] 2.3 Run `variant watch --detach` for a throwaway variant and verify both watches become ready on distinct ports, then `variant down`

## 3. Docs and gates

- [ ] 3.1 Mention the two scripts in `example/README.md` and add a `CHANGELOG.md` entry; verify the text matches the scripts
- [ ] 3.2 Verify `openspec validate --all --strict --no-interactive` and `task check:all` pass
