## 1. Worktree configuration and port

- [x] 1.1 Add failing tests in `packages/variant-config` for [specs/variant-config/core | Worktree configuration file](../../specs/variant-config/core/spec.md#requirement-worktree-configuration-file) and [specs/variant-config/core | variants.yaml schema](../../specs/variant-config/core/spec.md#requirement-variantsyaml-schema): a working directory inside `_v-demo` loads `_v-demo/variants.yaml` even when a parent `AGENTS.md` symlink names the primary checkout; a worktree with no file still uses that fallback; `db.port: ${POSTGRES_PORT}` resolves to the integer and `"not-a-number"` still fails; the published JSON schema accepts an integer or a string for `db.port`. Verify the new tests fail.
- [x] 1.2 Clamp discovery to the linked worktree when it has `variants.yaml` or `variants.yml`, and accept `db.port` as a positive integer or a single `${NAME}` / digit string, expanded to an integer. Verify the tests from 1.1 pass.

## 2. Cache files

- [x] 2.1 Add failing tests for [specs/variant-config/core | Local runtime state](../../specs/variant-config/core/spec.md#requirement-local-runtime-state), [specs/variant-config/cfg-runtime](../../specs/variant-config/cfg-runtime/spec.md), and [specs/variant-api/core | Create schema variant](../../specs/variant-api/core/spec.md#requirement-create-schema-variant): create and watch write `<variant>/.cache/variant/state.yaml` and `runtime.yaml`, do not create `variants.local.yaml` or `.cache/variants/<slug>.yaml`, skip a write whose text is unchanged, and a directory that only has `variants.local.yaml` still lists. Verify the new tests fail.
- [x] 2.2 Read and write those two files, with the legacy read and no legacy write. Point list, status, port reuse, down, implode, and the subscription at `state.yaml`. Verify the tests from 2.1 pass.

## 3. Init and variant config

- [x] 3.1 Add failing tests for [specs/variant-api/init | Init writes autodetected values](../../specs/variant-api/init/spec.md#requirement-init-writes-autodetected-values) and [specs/variant-config/core | Config CLI command](../../specs/variant-config/core/spec.md#requirement-config-cli-command): Postgres from mise writes `host`, `port`, `user`, and `password` as `${NAME}` with a `# from` comment and `database` as the detected name, and writes neither `variant.main` nor `variant.root`; `variant config` still prints both resolved paths. Verify the new tests fail.
- [x] 3.2 Teach init to emit those references and keep `variant config` printing the resolved main and root. Verify the tests from 3.1 pass.

## 4. Watch command from the worktree file

- [x] 4.1 Add a failing test for [specs/variant-api/runtime | Worktree file selects the watches](../../specs/variant-api/runtime/spec.md#requirement-worktree-file-selects-the-watches): `watch` in the worktree starts the worktree file's `api` and `spa` commands, sets `PORT` and `VARIANT_SPA_PORT` / `VARIANT_API_PORT`, and does not start `bun run dev` or `bun run start:dev` from the primary checkout. Verify the test fails.
- [x] 4.2 Make that watch use the loaded worktree file's commands and the existing command environment. Verify the test from 4.1 passes.

## 5. Colored implode report

- [x] 5.1 Add a failing test for [specs/variant-api/implode | Implode report](../../specs/variant-api/implode/spec.md#requirement-implode-report): an added hunk line is wrapped in `\033[32m`, a removed hunk line in `\033[31m`, the `+++` line has no ANSI, and the yellow command traces stay. Verify the test fails.
- [x] 5.2 Color those hunk lines in the report string after the plain diff is trimmed. Git color stays off. Verify the test from 5.1 passes.

## 6. Tree health check and dirty report

- [x] 6.1 Add failing tests in `packages/variant-vscode` for [specs/variant-vscode/variants-tree | Inline actions](../../specs/variant-vscode/variants-tree/spec.md#requirement-inline-actions): after play, the row shows `loading~spin` until the pid is alive and a GET of `{url}` joined with the watch `ready` path returns 200, then the watching icon shows and the external browser opens that URL once; a watch already healthy at load is not opened; a dead pid leaves the loading icon; a row with no URL, and a watch with no `ready` path, is not fetched and is not opened; activating the muted explosion writes the colored implode report to the extension output and does not call implode before Force. Verify the new tests fail.
- [x] 6.2 Run the health check off the tree render, open the URL once per start, and show the implode report in the output channel before the force notification. Verify the tests from 6.1 pass.

## 7. Migration, docs, and validation

- [~] 7.1 Add failing tests for [specs/variant-cli/config-migration](../../specs/variant-cli/config-migration/spec.md) and [specs/variant-vscode/config-migration](../../specs/variant-vscode/config-migration/spec.md): a `variants.local.yaml` that uses `runtime.instances` is not rewritten by the CLI or the extension. Verify the tests fail, then stop rewriting that file. Verify the tests pass.
- [ ] 7.2 Update `README.md`, `docs/guide/core.md`, `packages/variant-vscode/README.md`, and `CHANGELOG.md` for the worktree file, the cache paths, string `db.port`, the init references, the tree health check, and the colored dirty-implode report. Verify `task docs:build` passes.
- [ ] 7.3 Run `task lint`, `task test`, `task build`, and `openspec validate --all --strict --no-interactive`. Verify each passes.
