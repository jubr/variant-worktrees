## 1. Node runtime in variant-api

- [ ] 1.1 Add failing tests that the built `variant-api` imports under Node 22.13+ and under Bun and that creating a PostgreSQL client under Node loads no sqlite module; verify they fail on the Bun-only build
- [ ] 1.2 Make `db/sqlite.ts` pick `node:sqlite` or `bun:sqlite` lazily, drop the discarded `drizzle-orm/bun-sqlite` call, and add the missing-driver error; verify the sqlite create, list and destroy tests pass under Node and Bun
- [ ] 1.3 Replace `Bun.Glob` in `cleanup.ts` with `tinyglobby`; add tests for wildcard, brace alternatives, dotfiles, tracked file kept and match outside the worktree; verify they pass under Node and Bun
- [ ] 1.4 Set `engines.node` to `>=22.13.0`, add the `tinyglobby` dependency and externals, and verify `bun run build` produces a `dist/index.js` that contains no `bun:` specifier at load time

## 2. variant-cli package

- [ ] 2.1 Scaffold `packages/variant-cli` (manifest with `bin`, `engines.node`, dependencies on `variant-api` and `cleye`, tsconfig, build script like `variant-mcp`) and add `redacted` to the public exports of `variant-api`; verify `bun install` and `task build` succeed
- [ ] 2.2 `git mv` `cli.ts`, `cli-args.ts`, `help.ts`, `output.ts`, `text.ts`, `table.ts`, `duration.ts`, their tests and the `runCli` helper into `variant-cli`, rewrite imports to `variant-api` and `variant-api/commands`, and verify the moved CLI, help, output and list tests pass unchanged
- [ ] 2.3 Remove `bin` and `cleye` from `variant-api`; verify a test that its manifest has neither and that the MCP tests still pass
- [ ] 2.4 Read the version from the `variant-cli` manifest; verify `variant --version` and the `--help` header tests under Bun, Node, `dist/` and the compiled executable

## 3. Build, release and CI

- [ ] 3.1 Update the root `build` and `test` scripts, `Taskfile.yaml` (`bin:bun-shebang`, `package:cli`), `scripts/bun-shebang.sh` and `scripts/package-cli.ts` for the new package; verify `task build`, `task test` and `task package:cli` pass
- [ ] 3.2 Add `variant-cli` to `scripts/release-version.ts` and its spec; verify the script prints the shared version and fails with a differing one
- [ ] 3.3 Compile the executable and run `variant list` against a SQLite project; verify `create` and `list` work in the compiled file
- [ ] 3.4 Add a CI job (via a `task` target) that runs the library and CLI smoke tests under Node with the mise-pinned version and verify `task lint:workflows` passes

## 4. Documentation

- [ ] 4.1 Update `docs/guide/installation.md`, `README.md`, `docs/guide/core.md`, `docs/guide/library.md`, `AGENTS.md` (file structure) and `CHANGELOG.md` (**BREAKING**: `variant` moves to `variant-cli`; Node 22.13 support); verify `task docs:build` passes and the docs coverage test passes
- [ ] 4.2 Run `task lint`, `task test`, `task build`, `task check:full` and `openspec validate --all --strict --no-interactive` and verify all pass
