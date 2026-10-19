## Why

A reference project drives its test-environment variants with a set of shell scripts (`variant:up`, `variant:watch`,
`variant:down`, `variant:list`, `variant:implode`). They cover far more than `variant-api` does today: running the
apps of a variant (as containers or as host watchers), provisioning steps, per-variant dotenv files and storage,
tearing a variant down, and removing its worktree. Their project-specific choices (which directories `implode`
deletes, which lockfiles it restores, the base branch, branch prefixes, reserved ports, browser opening, readiness
paths, step commands) are hardcoded in bash, so no other project can reuse them. This change ports the whole feature
set into the TypeScript library, CLI and MCP server, and moves every project-specific choice into `variants.yaml`.

## What Changes

- New lifecycle commands: `up` (instances as containers), `watch` (instances as supervised host processes), and `down`
  (stop what runs, keep data).
- `destroy` is renamed to `implode` and absorbs the reference `implode`: stop running instances, drop the database
  target, delete the variant's storage, clear state including the runtime section of its `variants.local.yaml`, then
  remove the worktree behind a merge gate. There is no `destroy` alias.
- `provision` gains ordered, named **steps** (`variant.steps`) between the `up` commands and the seed command, plus
  per-instance dependency install, dotenv copy and variant storage.
- `list` reports runtime facts (mode, URL, directory, ports, whether processes are alive) read from the `runtime`
  section of `<root>/<prefix>*/variants.local.yaml` and of the main checkout's `variants.local.yaml`, in addition to state files and database targets.
- Hardcoded choices become `variants.yaml` options: `variant.baseBranch`, `variant.branchPrefixes`,
  `variant.containerEngine`, `variant.open`, `variant.reservedPorts`, `variant.storage`, `variant.steps`,
  `variant.supervise`, `variant.implode` (`preRm`, `restore`, `untracked`, `requireMerged`, `maxDiffLines`), and per
  instance `env`, `envAlways`, `dotenvSource`, `install`, `ready` and `container`.
- `variant.instances` becomes a record keyed by instance name (`fe:`, `be:`) instead of a list with a `name` field.
- Environment variables `VARIANT_<INSTANCE>_PORT`, `VARIANT_<INSTANCE>_URL` and `VARIANT_<INSTANCE>_PID` (for example
  `VARIANT_BE_PORT`) override the runtime state of `variants.local.yaml`, and every command sees the ports and URLs of
  all instances under those names.
- Command `env` values accept `{{NAME}}` and `{{NAME:-default}}` environment templates and the variant placeholders
  `{{slug}}`, `{{schema}}`, `{{storage}}`, `{{worktree}}`, `{{url}}`, `{{port}}` and `{{port.<instance>}}`.
- The MCP server exposes `variant_up`, `variant_down` and `variant_watch`, and `variant_destroy` becomes
  `variant_implode`.
- **BREAKING**: a `variant.instances` list and the instance `name` setting are no longer accepted; runtime state is keyed
  by the record key (unnamed autodetected instances were keyed by kind, now by directory name).
- **BREAKING**: the `destroy` command, the `destroy()` client method and the `variant_destroy` tool are removed in
  favor of `implode`, which also stops runtimes, deletes storage and removes the worktree; `list` records carry extra runtime
  fields; the `variant list` CLI gains a table view while its JSON output stays the default.

## Capabilities

### New Capabilities

- `variant-api/provisioning`: install, dotenv copy, storage, command environment, and the ordered steps that run
  before the seed command.
- `variant-api/runtime`: `up`, `watch`, `down` — ports, mode switching, container and host-process runtimes,
  supervision, readiness and browser opening, runtime state in `variants.local.yaml`.
- `variant-api/implode`: removing a variant together with its worktree, with a merge gate and configurable cleanup.

- `variant-config/cfg-instances`: instances as a keyed record, instance runtime options and container, autodetected
  watch commands.
- `variant-config/cfg-runtime`: environment overrides of runtime state, runtime-state discovery across worktrees,
  reserved ports in instance port resolution.
- `variant-config/cfg-settings`: branch naming, container engine and opening, storage, supervision and implode options.
- `variant-config/cfg-provisioning`: provisioning steps and command templates.

### Modified Capabilities

- `variant-config`: local runtime state (`variants.local.yaml`), the example project, and removal of the superseded
  instance ports requirement.
- `variant-api/core`: `destroy` renamed to `implode` as the full teardown, list with runtime facts, branch prefixes in slug resolution, and the
  configurable base branch for new worktrees.
- `variant-api/commands`: the lifecycle command set (without `destroy`) and the flags of the new commands.
- `variant-mcp/tools`: tools for `up`, `down` and `watch`; `variant_destroy` renamed to `variant_implode`.
- `variant-vscode/ipc-endpoint`: the refused lifecycle command names include the new commands and not `destroy`.

## Impact

- Code: `variant-config` (schema, template rendering, runtime scan, example and JSON schemas), `variant-api`
  (operations, process/container supervision, commands, CLI flags), `variant-mcp` (tools), `example/` (new options),
  `docs/` (a migration guide from the shell scripts and the new options).
- No new runtime dependencies are expected; container engines and `git` are invoked as external commands.
- Existing `variants.yaml` files stay valid; every new option is optional.

## Non-goals

- Porting the bash test suite one-to-one. Behavior is covered by `bun:test` suites that use real git repositories,
  SQLite, and a stub container-engine executable instead of Docker or Postgres.
- Legacy-layout migrations of the reference project (`.variants` directory, `workspaceFolder`/project-name state
  directory search, `psql`/in-container `pg_dump` fallback). State stays under `.cache/variants`, and database
  work goes through the existing adapters.
- Project-specific content of the scripts (company bootstrap, demo dataset, app role, migrations). These become
  entries of `variant.steps` in the owning project's `variants.yaml`.
- Changing the VS Code extension or its socket protocol.
