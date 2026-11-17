## 1. Rename the example scripts

- [x] 1.1 Update `example-project.spec.ts` to expect `server:watch` in `example/be` with `--no-clear-screen`, plus `app:watch` in `example/fe` and no `dev`/`start:dev`; verify the new test fails
- [x] 1.2 Rename `dev` to `app:watch` in `example/fe/package.json` and `start:dev` to `server:watch` in `example/be/package.json`; verify the test from 1.1 passes
- [x] 1.3 Point both watches of `example/variants.yaml` at `bun run server:watch` and `bun run app:watch`, and update `example/README.md`; verify a repo search for `bun run dev` and `start:dev` under `example/` finds nothing

## 2. Root variants.yaml

- [x] 2.1 Add a failing test in `example-project.spec.ts` that loads the root `variants.yaml` and asserts its schema validity, the `PORT`/`VARIANT_API_PORT` overrides and the watch commands of `example-be` and `example-fe`, and that `example/variants.yaml` uses the same commands
- [x] 2.2 Commit the root `variants.yaml` (copied from the main checkout, where it is untracked) with `PORT: '${port}'` on both watches, `VARIANT_API_PORT: '${example-be.port}'` on `example-fe`, commands `bun run server:watch` and `bun run app:watch`, and `ready` on `example-fe`; verify the test from 2.1 passes and `git ls-files variants.yaml` lists it
- [x] 2.3 Run `variant watch --detach` for a throwaway variant and verify both watches become ready on distinct ports, then `variant down`

## 3. No empty state directory

- [x] 3.1 Add a failing test in `variant-api` that creates a client with a SQLite connection whose `db.filename` lies elsewhere, runs `list()`, and asserts the state directory does not exist; verify it fails for that reason
- [x] 3.2 Remove the eager `mkdirSync` of the state directory in `createVariantClient`; verify the test from 3.1 passes and `bun test` in `variant-api` and `variant-cli` stays green, including a default-location SQLite `provision` that still creates `.cache/variants/<slug>.db`
- [x] 3.3 Point `SQLITE_DATABASE` of `example-be` in the root `variants.yaml` at `${worktree}/.cache/variant/${schema}.sqlite`; verify the root-file test asserts it and a watch run leaves `example/be/` free of database files and `.cache/variants/` absent

## 4. Example be events

- [x] 4.1 Add a failing `events.spec.ts` in `example/be/src` that opens a store on a missing file and expects the `events` table and a `startup` row after `record("startup", …)`; verify it fails because the module is missing
- [x] 4.2 Implement `events.ts` (open, directory, `CREATE TABLE IF NOT EXISTS`, `record`); verify 4.1 passes, and a second open keeps the old rows
- [x] 4.3 Add a failing spec for a request middleware that records `request` rows with `METHOD URL status` when the response finishes; implement it; verify with `bun test` in `example/be`
- [x] 4.4 Wire the store and middleware in `main.ts` (`startup` after `listen`); verify by running `bun run server:watch` with a temp `SQLITE_DATABASE`, requesting `/api` and `/missing`, and reading `events` back
- [x] 4.5 Describe the events table in `example/README.md`; verify the README names `events`, its columns and the two kinds

- [x] 4.6 Print `sqlite: opened <path>` when the database opens; verify a spec captures the line and the `watch.log` of a watch shows it

## 5. Docs and gates

- [x] 5.1 Add `CHANGELOG.md` entries for the renamed example scripts, the root `variants.yaml`, the state directory and the events; verify no other doc under `docs/`, `README.md` or `packages/*/README.md` names the example's old scripts
- [x] 5.2 Verify `openspec validate --all --strict --no-interactive` and `task check:all` pass
