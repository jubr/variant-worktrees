## 1. Configuration schema and templates

- [x] 1.1 Add failing `variant-config` tests for the new options of the `variant-config` delta: `baseBranch` and `branchPrefixes` defaults and validation, `containerEngine` and `open`, `reservedPorts`, `storage`, `steps` (unique names, valid `show`, no escaping `dir`), `supervise`, `implode`, and the instance `env`, `envAlways`, `dotenvSource`, `install`, `ready` and `container` rules including `proxy.to` references; `variant.instances` as a keyed record (list and `name` refused, colliding environment segments refused, autodetected keys from directory names with numeric suffixes, key order kept). Verify the tests fail before implementation.
- [x] 1.2 Extend the Zod schemas and resolved configuration in `variant-config` so those tests pass, resolving defaults in `loadConfig`. Verify `bun test` for `variant-config` passes.
- [x] 1.3 Add failing tests for `renderTemplate`: variant placeholders, `{{port.<name>}}`, `{{NAME}}`, `{{NAME:-default}}` with a nested `{{slug}}`, empty-variable default, and an unset variable that throws naming it. Implement it and verify the tests pass.
- [x] 1.4 Add failing tests for `resolveInstancePort` and `readRuntime`: reserved ports (default list never picked, empty list allowed, explicit reserved port accepted), `VARIANT_<K>_PORT`, `_URL` and `_PID` overrides over the file and over derived values, hyphenated keys, empty variables ignored, invalid values naming the variable, and discovery ignoring overrides. Replace `instanceKey` with the record key, implement, and verify.
- [x] 1.5 Add failing tests for `readRuntimes`: prefixed worktrees, the main checkout beside the root and as the root itself, other directories and nested files ignored, a custom prefix, a file without `runtime`, and an invalid file reported without failing. Implement it and verify the tests pass.
- [x] 1.6 Regenerate `variants.yaml.schema.json` and `variants.local.yaml.schema.json`, convert `variants.example.yaml` and `variants.local.example.yaml` to the keyed instance record (the first is already edited by hand in the working tree) and extend them with every new option, update `docs/guide/library.md` for the record form and `runtime.instances.<key>`, and verify the existing example-coverage test passes.
- [x] 1.7 Commit the task group (`feat(variant-config): ...`) after `task lint` and the package tests are green.

## 2. Branch settings in the library

- [x] 2.1 Add failing `variant-api` tests (real temporary git repositories) for slug derivation with configured prefixes, a new worktree branch from `baseBranch` with the first prefix, and an existing `fix/` branch being reused. Verify they fail before implementation.
- [x] 2.2 Thread `baseBranch` and `branchPrefixes` through `sanitizeSlug`, `resolveSlug` and `ensureWorktree` (keeping the current defaults for callers that pass nothing). Verify the tests from 2.1 and the existing slug and worktree tests pass.
- [x] 2.3 Commit the task group.

## 3. Provisioning

- [x] 3.1 Add failing `variant-api` tests against the `example/`-style fixture and SQLite for: the order up → steps → seed, failure naming the step and stopping, step `dir`, `unlessEnv` skipping, `show` filtering with failure and verbose behavior, `install` only without `node_modules`, and the command environment (database settings, `host.docker.internal` rewrite, `VARIANT_<K>_PORT`/`_URL` of all instances, step `env` winning). Verify they fail before implementation.
- [x] 3.2 Add failing tests for the dotenv copy (copy from the primary worktree, kept existing file with `envAlways` still applied, `dotenvSource`, `VARIANT_ENV_SOURCE`, missing source warning, primary worktree untouched) and the storage directory (default, custom variable, not configured). Verify they fail before implementation.
- [x] 3.3 Implement the provisioning pipeline in `variant-api` so `provision` runs it, with `--verbose` support, and verify the tests from 3.1 and 3.2 plus the existing `provision` tests pass.
- [x] 3.4 Commit the task group.

## 4. Runtime state and listing

- [x] 4.1 Add failing tests for the worktree-relative location of `variants.local.yaml`, for writing and clearing the `runtime` section with other keys kept, and for pid liveness (running, dead, permission error). Implement and verify.
- [x] 4.2 Add failing `list` tests for merged state, database and runtime-file facts (directory, mode, URL, per-instance port, pid and alive), a database-only variant, and an unreadable runtime file. Implement the merge in `listVariants` and verify.
- [x] 4.3 Add a failing CLI test for `variant list --table` (columns, ordering, `-` for missing values, directory relative to the variant root) and for JSON staying the default. Implement the table view and verify.
- [x] 4.4 Commit the task group.

## 5. Down and teardown

- [x] 5.1 Add failing tests for `down`: terminate recorded host processes and their children, a stale pid, remove containers, network and generated nginx configuration through the stub engine, clear only the `runtime` section, keep data, work for `main`, and succeed when nothing runs. Add the pid-ownership check described in the design and a test that a recorded pid outside the worktree is not signalled. Verify they fail before implementation.
- [x] 5.2 Implement process-group stop (SIGTERM then SIGKILL after a grace period) and container teardown, expose `down` on the client, and verify the tests pass.
- [x] 5.3 Rename `destroy` to `implode` across `variant-api` (operation file, client method, command definition, types, CLI), `variant-mcp` (`variant_destroy` to `variant_implode`) and the VS Code extension's refused-command list, updating every existing test and the docs that name `destroy`. Add failing tests that the teardown stops the runtime first, deletes the storage directory and clears the runtime section, with the `main` and missing-variant behaviors unchanged, that `variant destroy` is an unknown command, and that the extension refuses `up`, `down`, `watch` and `implode`. Verify the renamed and new tests pass; the worktree part follows in group 8.
- [x] 5.4 Commit the task group.

## 6. Containers (`up`)

- [x] 6.1 Add a stub container engine executable for tests (records argv, answers `inspect`, can fail on demand) and failing tests for `up`: clean target recreation, port reuse, environment port override, conflicting overrides and distinct ports, build command, image build for `dockerfile`, network create and container replace, port publishing, `host.docker.internal` handling, volumes and env precedence, listed-order start with `startDelaySeconds`, engine selection and the no-engine error, mode switch stopping a recorded watch, and runtime state written. Verify they fail before implementation.
- [x] 6.2 Add failing tests for the generated static-site configuration: file serving, `index.html` fallback, `server_name` from the `open` URL host, proxy block with WebSocket upgrade, and removal on stop. Verify they fail before implementation.
- [x] 6.3 Implement `up` and the nginx configuration and expose them on the client; verify the tests from 6.1 and 6.2 pass.
- [x] 6.4 Commit the task group.

## 7. Host processes (`watch`)

- [x] 7.1 Add failing tests for `watch` with fixture commands (small Bun scripts): process start per instance in order with delay, pids recorded, instance without `watch` skipped, variant-wide `variant.watch` fallback, re-run replacing leftovers, mode switch stopping containers, and keeping an existing target. Verify they fail before implementation.
- [x] 7.2 Add failing supervision tests: abort/SIGINT ends with 130 and clears pids, one dying instance ends the others with 1, a vanished worktree drops the target and ends with 1, `checkoutPollSeconds: 0` disables the check, and `detach` returns with processes alive. Verify they fail before implementation.
- [x] 7.3 Add failing readiness and opening tests with a local HTTP server and an injectable opener: open after `ready` answers, open immediately without `ready`, timeout warning without opening, `variant.open: false` and `VARIANT_OPEN=0`, and an opener failure not failing the command. Verify they fail before implementation.
- [x] 7.4 Implement `watch`, supervision, readiness polling and URL opening, expose them on the client with an `exitCode` result, and verify the tests from 7.1 to 7.3 pass.
- [x] 7.5 Commit the task group.

## 8. Implode

- [x] 8.1 Add failing tests with real git repositories for the merge gate (refused unmerged, remote base branch, local fallback, `requireMerged: false`, `force`), refusing `main`, teardown before worktree removal, no-worktree variants, `untracked` deletion that keeps tracked files, `preRm` per instance directory, lockfile restore after the report, report contents with and without the full diff, and the branch being kept. Verify they fail before implementation.
- [x] 8.2 Implement `implode` and expose it on the client; verify the tests pass.
- [x] 8.3 Commit the task group.

## 9. Commands, CLI and MCP

- [x] 9.1 Add failing tests that `commands` includes `up`, `down`, `watch` and `implode` and no `destroy`, with `detach`, `force` and `verbose`, that the CLI turns those flags into `execute()` arguments (including `--detach`, `--force`, `--verbose`), that attached `watch` sets the process exit code, and that none of these commands reach the VS Code socket. Verify they fail before implementation.
- [x] 9.2 Extend the command definitions and the CLI flag generation, then add failing and then passing MCP tests for `variant_up`, `variant_watch` (always detached) and `variant_down`, and update `variant_implode` (including the unmerged error) and the absence of `variant_destroy`. Verify the `variant-api` and `variant-mcp` suites pass.
- [x] 9.3 Commit the task group.

## 10. Example project and documentation

- [x] 10.1 Convert `example/variants.yaml` to the keyed instance record and extend it with `steps`, `implode` (`preRm: [dist, node_modules, .cache, out]`), `storage`, `ready`, `env` and a `container` for its instances, and verify the existing example tests (config and API) still pass and cover the new options.
- [x] 10.2 Add a VitePress guide that maps every reference script and environment switch to the new commands and options (the tables of the design), documents the template syntax and the `variants.yaml` options, and link it from the sidebar. Verify `task docs:build` (or the repository's docs build task) succeeds and the page lists every option of the proposal.
- [x] 10.3 Update the MCP documentation and the other docs and README pages that name `destroy` (three new tools, `variant_implode`) and verify no page mentions `destroy` as a command or tool.
- [x] 10.4 Commit the task group.

## 11. Validation

- [x] 11.1 Run `openspec validate --all --strict --no-interactive` and verify `port-variant-scripts` is valid.
- [x] 11.2 Run `task lint`, `task test` and `task build` and verify all pass.
- [x] 11.3 Manually check `up` and `watch` for `example/` against a real container engine and a real browser, and note the result in the pull request description (not a CI gate).
