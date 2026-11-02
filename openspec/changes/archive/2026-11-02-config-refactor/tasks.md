## 1. Template and schema (variant-config)

- [x] 1.1 Add failing tests, then change `renderTemplate` to `{{<key>.port}}` and throw a message naming `{{<key>.port}}` for `{{port.<key>}}`; verify `bun test packages/variant-config/test/template.test.ts` passes
- [x] 1.2 Add failing schema tests, then replace `open` with `url`, the instance `dotenv`/`dotenvSource`/`env`/`envAlways` with `env: { sourceFile, overrides }`, and `storage.env` with `envVarName`; verify `schema.test.ts`, `options.test.ts` and `instances.test.ts` pass with old keys rejected
- [x] 1.3 Add failing schema tests, then rename step `show` to `filterLinesRegex`, drop `unlessEnv`, restrict step names to `[A-Za-z0-9_-]+` and reject segment collisions; verify the step tests pass
- [x] 1.4 Add failing schema tests, then merge `implode.untracked` into `preRm` (globs, no absolute or `..`) and rename `restore` to `discard`; verify the settings tests pass
- [x] 1.5 Add failing schema tests, then reduce `container` to `dockerfile` and `internalPort`, remove the proxy cross-check and `variant.up`/`variant.watch`, update `runtimeCommandFor`, `ResolvedVariant`, `DEFAULT_URL` and autodetection (`url` on Vite instances); verify `bun test packages/variant-config` passes
- [x] 1.6 Adapt `dotenv.ts` (`dotenvFor` reads `env.sourceFile`) with its test; regenerate `variants.yaml.schema.json` and check `variants.local.yaml.schema.json` and `variants.local.example.yaml` stay valid; rewrite `variants.example.yaml` (keep the user's edits and remove `variant.up`, `variant.watch` and, from the `fe` container, `image`, `build`, `static`, `internalPort`, `proxy`, `env`); verify `example.test.ts` and `schema-file.test.ts` pass and `task lint` is clean

## 2. Provisioning and run context (variant-api)

- [x] 2.1 Add failing tests, then write the env file copy from `env.sourceFile` and `env.overrides` on creation only, add the storage variable, skip the primary worktree, drop `dotenvSource`; verify `provisioning.test.ts` env file scenarios pass
- [x] 2.2 Add failing tests, then skip a step on `VARIANT_STEP_<S>=no`, filter with `filterLinesRegex` and use only instance `up` commands; verify `provisioning.test.ts` and `command-echo.test.ts` pass
- [x] 2.3 Add failing tests, then render instance URLs from `url`, pass `env.overrides` as the instance command environment, name the variable from `storage.envVarName`; verify `run-context` related tests, `ready` tests and `bun test packages/variant-api` for those files pass

## 3. Implode cleanup

- [x] 3.1 Add failing tests, then implement `preRm` globs (files and directories, project directory and each instance directory, tracked matches kept, symlinks not followed, `{{slug}}` replaced) and `discard`, replacing `removeUntracked`/`removeDirectories`; verify `implode.test.ts` and `node-runtime.test.ts` pass under Bun and Node, including removal before the report

## 4. Containers

- [x] 4.1 Add failing tests, then build `v-<key>:v-<slug>` from `container.dockerfile`, publish to `internalPort` (default 80), pass only the variant variables without host paths, and delete `nginx.ts`, `nginxConfigPath`, the static, build, proxy, volume and env handling and `test/nginx.test.ts`; verify `up.test.ts` and `down.test.ts` pass
- [x] 4.2 Remove the variant-wide `watch` fallback and the matching warning text; verify `watch.test.ts` and `watch-warning.test.ts` pass

## 5. Example project

- [x] 5.1 Rewrite `example/variants.yaml` to the new shape (`url`, `env.sourceFile`, `env.overrides`, `storage.envVarName`, `filterLinesRegex`, `preRm`/`discard`, container `dockerfile` and `internalPort`) and fix comments naming `open` and `{{port.be}}` in `example/fe/vite.config.ts` and `example/be/src/main.ts`; verify `example-project.test.ts` passes
- [x] 5.2 Add `example/fe/Dockerfile` (bun build stage, `FROM nginx:alpine` final stage, nginx template proxying `/api/` to `v-be-${VARIANT_SLUG}:3000`, `NGINX_ENVSUBST_FILTER=VARIANT_`) and give `example/be/Dockerfile` its own `SQLITE_DATABASE`; verify the example test for container files passes and, when a container engine exists, `variant up` serves the page and `/api/` through `fe`
- [x] 5.3 Update `example/README.md` for the new shape and the in-container database; verify with `rg` that no removed key remains in `example/`

## 6. Documentation

- [x] 6.1 Update `docs/guide/configuration.md` (including a table of old key to new key), `docs/guide/core.md`, `docs/guide/library.md`, `docs/mcp.md`, `README.md`, `packages/variant-vscode/README.md` and the MCP test fixtures; verify `task docs:build` passes
- [x] 6.2 Describe the `VARIANT_*` mapping (override or set for commands, `<KEY>`/`<NAME>` derivation) in `README.md` and `docs/guide/configuration.md`, with a failing test in `scripts/docs-coverage.spec.ts` first; add the `CHANGELOG.md` entry; verify the docs coverage test passes
- [x] 6.3 Verify no stale term remains: `rg -n 'dotenv|envAlways|unlessEnv|untracked|restore:|\bshow:|open:|\{\{port\.|container\.(static|build|proxy|port|image|volumes|env)|variant\.(up|watch)'` over `packages/`, `docs/`, `example/` and `README.md` finds only intended uses

## 7. Final verification

- [x] 7.1 Run `task check:full` and `openspec validate --all --strict --no-interactive`; verify both pass
