## 1. Configuration schema and templates

- [x] 1.1 Failing `variant-config` tests for the delta options (`baseBranch`, `branchPrefixes`, `containerEngine`, `open`, `reservedPorts`, `storage`, `steps`, `supervise`, `implode`, instance `env`/`envAlways`/`dotenvSource`/`install`/`ready`/`container` incl. `proxy.to`) and for `variant.instances` as a keyed record.
- [x] 1.2 Extend the Zod schemas and resolved configuration; defaults resolved in `loadConfig`.
- [x] 1.3 `renderTemplate` with tests: variant placeholders, `{{port.<name>}}`, `{{NAME}}`, `{{NAME:-default}}`, unset variable error.
- [x] 1.4 `resolveInstancePort` and `readRuntime` with tests: reserved ports, `VARIANT_<K>_PORT`/`_URL`/`_PID` overrides, invalid values; `instanceKey` replaced by the record key.
- [x] 1.5 `readRuntimes` with tests: prefixed worktrees, main checkout, ignored directories, custom prefix, invalid file reported.
- [x] 1.6 Regenerate both JSON schemas, convert the example YAML files to the keyed record, update `docs/guide/library.md`.
- [x] 1.7 Commit the task group (`feat(variant-config): ...`) after `task lint` and package tests are green.

## 2. Branch settings in the library

- [x] 2.1 Failing `variant-api` tests (real git repositories): slug derivation with configured prefixes, new branch from `baseBranch`, existing `fix/` branch reused.
- [x] 2.2 Thread `baseBranch` and `branchPrefixes` through `sanitizeSlug`, `resolveSlug` and `ensureWorktree`; defaults kept for callers that pass nothing.
- [x] 2.3 Commit the task group.

## 3. Provisioning

- [x] 3.1 Failing tests (`example/`-style fixture, SQLite): order up → steps → seed, step failure, `dir`, `unlessEnv`, `show`, `install`, command environment.
- [x] 3.2 Failing tests: dotenv copy (`envAlways`, `dotenvSource`, `VARIANT_ENV_SOURCE`, missing source) and storage directory.
- [x] 3.3 Implement the provisioning pipeline behind `provision`, with `--verbose`.
- [x] 3.4 Commit the task group.

## 4. Runtime state and listing

- [x] 4.1 Worktree-relative `variants.local.yaml`; write and clear the `runtime` section keeping other keys; pid liveness.
- [x] 4.2 `listVariants` merges state, database and runtime-file facts; database-only variants; unreadable file.
- [x] 4.3 `variant list --table` (columns, ordering, `-` for missing values); JSON stays default.
- [x] 4.4 Commit the task group.

## 5. Down and teardown

- [x] 5.1 Failing `down` tests: stop host processes and children, stale pid, containers, network, nginx config, clear only `runtime`, work for `main`; pid-ownership check.
- [x] 5.2 Process-group stop (SIGTERM, then SIGKILL after a grace period) and container teardown; `down` on the client.
- [x] 5.3 Rename `destroy` to `implode` across `variant-api`, `variant-mcp`, the VS Code refused-command list and docs; teardown first, storage deleted, runtime cleared.
- [x] 5.4 Commit the task group.

## 6. Containers (`up`)

- [x] 6.1 Stub container engine and failing `up` tests: recreation, ports and overrides, build, network, container replace, volumes, env precedence, start order and delay, engine selection, mode switch.
- [x] 6.2 Failing tests for the generated static-site nginx configuration (fallback, `server_name`, proxy with WebSocket upgrade, removal).
- [x] 6.3 Implement `up` and the nginx configuration; expose on the client.
- [x] 6.4 Commit the task group.

## 7. Host processes (`watch`)

- [x] 7.1 Failing `watch` tests with fixture commands: ordered start with delay, pids, skipped instances, `variant.watch` fallback, re-run, mode switch.
- [x] 7.2 Failing supervision tests: SIGINT exit 130, one instance dying exits 1, vanished worktree, `checkoutPollSeconds: 0`, `detach`.
- [x] 7.3 Failing readiness and opening tests: after `ready`, immediately, timeout warning, `open: false` and `VARIANT_OPEN=0`, opener failure tolerated.
- [x] 7.4 Implement `watch`, supervision, readiness and opening; `exitCode` result on the client.
- [x] 7.5 Commit the task group.

## 8. Implode

- [x] 8.1 Failing tests (real git): merge gate, `requireMerged: false`, `force`, refusing `main`, teardown order, `untracked`, `preRm`, lockfile restore, report, branch kept.
- [x] 8.2 Implement `implode`; expose on the client.
- [x] 8.3 Commit the task group.

## 9. Commands, CLI and MCP

- [x] 9.1 Failing tests: `commands` has `up`, `down`, `watch`, `implode` (no `destroy`) with `detach`, `force`, `verbose`; CLI flags; attached `watch` exit code; none reach the VS Code socket.
- [x] 9.2 Command definitions and CLI flags; MCP `variant_up`, `variant_watch` (always detached), `variant_down`, `variant_implode`; no `variant_destroy`.
- [x] 9.3 Commit the task group.

## 10. Example project and documentation

- [x] 10.1 Convert `example/variants.yaml` to the keyed record with `steps`, `implode`, `storage`, `ready`, `env`, `container`; example tests cover them.
- [x] 10.2 VitePress guide mapping every reference script and switch to commands and options; sidebar link; docs build passes.
- [x] 10.3 Update MCP docs, README and other pages that name `destroy`.
- [x] 10.4 Commit the task group.

## 11. Validation

- [x] 11.1 `openspec validate --all --strict --no-interactive` is valid for `port-variant-scripts`.
- [x] 11.2 `task lint`, `task test` and `task build` pass.
- [x] 11.3 Manually check `up` and `watch` for `example/` with a real engine and browser; note in the PR description (not a CI gate).

## 12. Command echo

- [x] 12.1 Failing tests: `+ <command>` through `log` for install, `up`, steps and seed (not for skipped steps, without `verbose`); `up`/`down` echo engine commands with `-e NAME=***` masking, no `inspect`.
- [x] 12.2 Add `log` to provisioning and the `provision` call; thread through `up`, `watch` preparation and container stop (default standard error).
- [x] 12.3 Document the printed command lines; commit the task group.

## 13. Project directory

- [x] 13.1 Failing tests (real git, `variants.yaml` in `app/`): seed, steps, `up`, dotenv, `watch` run in the project directory; `main` agrees from `app` and the root; root configuration unchanged.
- [x] 13.2 Resolve relative paths against `variantConfigDir` (checkout root without worktree), incl. `preRm`.
- [x] 13.3 Run the example from `example/` in place; tidy its README; commit the task group.

## 14. Watch without commands

- [x] 14.1 Failing tests: `watch` warns naming `watch` and `variant.watch` when no process starts, not otherwise.
- [x] 14.2 Print the warning; commit the task group.

## 15. Console-keeping watch commands

- [x] 15.1 Failing `variant-config` tests: autodetected `watch` gets `--clearScreen false`, `--preserveWatchOutput` or inserted `--no-clear-screen`; none when the project owns the setting.
- [x] 15.2 Derive the `watch` command in autodetection, adjust suites, document it, commit the task group.
