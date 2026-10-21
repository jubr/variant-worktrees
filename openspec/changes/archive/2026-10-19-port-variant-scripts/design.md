## Context

`variant-api` already creates and drops database targets, manages `_v-<slug>` worktrees, runs `up` and seed
commands, and reads per-variant runtime state (`runtime` in `variants.local.yaml`) through `variant-config`. The
reference shell scripts add: container and host-process runtimes, supervision, a dotenv copy, storage, ordered
provisioning commands, a runtime-aware inventory, and `implode`. Their runtime state lived in
`.cache/variants/<slug>.yaml` next to the scripts; here runtime facts belong in each variant's own
`variants.local.yaml`, so the inventory has to read them across worktrees.

Constraints: strict ESM TypeScript on Bun, Zod v4 schemas as the source of truth, no new runtime dependency, tests
must run without Docker or a Postgres server, and `variants.yaml` stays backward compatible.

## Goals / Non-Goals

**Goals:**

- Every behavior of the reference scripts is reachable through `variant-api`, with one observable contract for CLI
  and MCP.
- Project-specific choices live in `variants.yaml` (see the proposal for the list), not in code.
- Runtime state is read from and written to `variants.local.yaml` only.

**Non-Goals:**

- A bash-compatible CLI surface (`task variant:up` names and `VARIANT_*` env switches other than the ones kept below).
- Generic orchestration (compose-style dependency graphs, health-driven restarts).
- Handling a state directory outside `.cache/variants`.

## Decisions

### Command mapping

| Reference script / task | This project |
| --- | --- |
| `variant:up` | `variant up` |
| `variant:watch` | `variant watch` (`--detach` for non-attached) |
| `variant:down` | `variant down` (stop, keep data); the data-dropping half is part of `variant implode` |
| `variant:list` | `variant list` (`--table` for the old table) |
| `variant:implode` | `variant implode` (`--force` replaces `VARIANT_FORCE=1`); it also replaces `destroy` |
| `CLI_VERBOSE` (`task -v`) | `--verbose` |
| `CONTAINER_ENGINE`, `VARIANT_OPEN`, `VARIANT_ENV_SOURCE` | kept as environment overrides of `variant.containerEngine`, `variant.open`, `dotenvSource` |

The script's `down` dropped the database target. Here `destroy` is renamed to `implode` and includes that teardown
plus worktree removal, so one destructive command exists. A separate non-destructive `down` is added because slug
`main` must be stoppable and `implode` refuses `main`. No `destroy` alias is kept (the rename is deliberate and
breaking); the teardown stays an internal function that `implode` calls after the gate.

### Where each hardcoded choice went

| Hardcoded in bash | Option |
| --- | --- |
| `*/dist` removed on implode | `variant.implode.preRm` (names below each instance directory) |
| `package-lock.json`, `bun.lock` restored | `variant.implode.restore` |
| `pr[0-9]*-$slug-demo.{webm,gif}` removed | `variant.implode.untracked` |
| merge gate against `origin/main`, `main` | `variant.baseBranch`, `variant.implode.requireMerged` |
| 200-line diff cut-off | `variant.implode.maxDiffLines` |
| `main`, `feat/`, `fix/`, `feature/` | `variant.baseBranch`, `variant.branchPrefixes` |
| reserved ports 3000, 4200, 5432 | `variant.reservedPorts` |
| `docker` then `podman` | `variant.containerEngine` |
| `VARIANT_OPEN` | `variant.open` |
| `.storage`, `STORAGE_ROOT` | `variant.storage` |
| migrate, role, seed, company, demo commands | `variant.steps` |
| `sleep 2`, 180 s readiness, 5 s checkout poll | `variant.supervise` |
| `/api/health/live` | instance `ready` |
| `server/.env` copy and `POSTGRES_SCHEMA`/`PUBLIC_BASE_URL` patch | instance `dotenv`, `dotenvSource`, `env`, `envAlways` |
| `bun install` when `node_modules` missing | instance `install` |
| image, Dockerfile, nginx proxy, volumes | instance `container` |
| `JWT_SECRET` default `variant-local-<slug>` | `env: { JWT_SECRET: "{{JWT_SECRET:-variant-local-{{slug}}}}" }` |

### Runtime state lives in the worktree, discovery by scan

`up` and `watch` write `runtime` through the existing `writeRuntime`. `list` calls a new `readRuntimes` that reads
exactly `<root>/<prefix>*/variants.local.yaml` plus the primary worktree's `variants.local.yaml`, where `<root>` is
the resolved variant root. Directory listing of one level plus one file per match replaces a tree walk, so the
cost is the number of worktrees, no skip list is needed, and nested example or fixture files can never be mistaken
for variants. The scan finds worktrees that git no longer lists (a deleted checkout still showing a running watch)
and needs no registry that could drift. Alternative considered: a central registry under `.cache/variants`;
rejected because it is the duplicated state the new `runtime` section replaced. Alternative: `**/variants.local.yaml`
below the root; rejected as slower, noisy (`node_modules`, examples) and unbounded.

Liveness is `process.kill(pid, 0)`; a permission error counts as alive.

### Templates are rendered in two passes

Variant placeholders first, then environment templates. This lets
`{{JWT_SECRET:-variant-local-{{slug}}}}` work without a nested-template grammar. An unset `{{NAME}}` throws and names
the variable, unlike the lenient reading of `variants.local.yaml`, because a silently empty secret or port is worse
than a failed command. A single `renderTemplate(value, context)` lives in `variant-config`; the two readers do not
share a regular expression.

### Provisioning is one pipeline for `provision`, `up` and `watch`

`provision` already runs `up` commands then the seed command. It gains install, dotenv, storage and steps, and
`up` / `watch` call the same function, so a step never behaves differently between the commands. Steps run through
`sh -c` like existing commands, with output captured; `show` filters captured output. This is the same mechanism as
the awk filter of the reference migration step, expressed as a regular expression the user owns.

### Processes and containers

- Host processes spawn with `Bun.spawn`/`node:child_process` in their own process group. Stopping sends SIGTERM to
  the group, then SIGKILL after a grace period. The reference script used `pkill -P` because it had no group.
- Containers go through the engine binary (`docker`/`podman`) with `execFile` arguments, never a shell string.
  Container names and the network follow `v-<key>-<slug>` / `v-net-<slug>` so `down` can remove them without
  reading state. Tests put a stub `docker` executable first on `PATH` that records its argv and answers
  `inspect`, so no daemon is required.
- The generated nginx configuration is written next to the state files (`<slug>.<key>.nginx.conf`), as in the
  reference, and removed by `down`.
- `container.proxy` produces the same server block as the reference, with `server_name` taken from the host of the
  rendered `open` URL; the reference hardcoded `<slug>.app.localhost`.

### Attached watch is a library function with an exit status

`watch` in the library resolves with an `exitCode` (0 detached, 130 interrupted, 1 failed) instead of calling
`process.exit`, so the CLI sets `process.exitCode` and tests can drive signals through an injectable `AbortSignal`
as well as real SIGINT. MCP always passes `detach: true`.

### Instances are a record; overrides use the key

A list with an optional `name` needed a second rule (key by name, else by kind) that every consumer had to repeat
(`instanceKey`). A record has one key everywhere: runtime state, templates (`{{port.be}}`), container names,
environment variables. YAML preserves key order, which keeps the start order explicit. The environment segment is
derived by uppercasing and replacing non-alphanumerics with `_`; two keys that collide are rejected at load, since
an override could not tell them apart. Overrides are applied by the single `readRuntime` of the loaded variant and not
by the cross-worktree scan, otherwise one shell variable would rewrite every other variant's listed port. The same
names are exported to child commands, so a step can read `VARIANT_BE_PORT` without a template. Alternative: also
accept the list form for a deprecation period; rejected because the package is pre-1.0 and two shapes would double
the schema and example surface.

### Worktree-relative locations

A variant's `variants.local.yaml` sits where its `variants.yaml` sits. For a worktree this is the primary
`configDir` re-based onto the worktree (`relative(primaryRoot, configDir)`), which is the repository root in the
common layout. Reading and writing for a slug uses one helper so the layout assumption exists once.

### Implode order

Gate, then teardown, then untracked and `preRm` removal, then report, then restore lockfiles, then
`git worktree remove`. Report-before-restore preserves the reference behavior: the user sees the lockfile noise that
is about to be discarded. The gate runs before anything is stopped so a refusal leaves the variant usable.

## Risks / Trade-offs

- [`up` drops and recreates the variant target on every run, as the reference did] → Documented in the spec and
  restricted to `v_*` targets and slugs other than `main`; `watch` keeps data.
- [A generic `container` model cannot express every Dockerfile or compose feature] → It covers the reference
  behavior (build, publish, volumes, env, static + proxy); anything else stays a user `up`/`steps` command.
- [Killing process groups can hit unrelated processes if a recorded pid was reused] → `down` verifies the pid is
  alive and, where `ps` reports it, that its working directory is below the variant worktree before signalling.
- [A worktree created under another prefix or outside the root is not listed] → Intended: only
  `<root>/<prefix>*` and the main checkout are variants of this workspace; state files and database targets still
  list them by slug.
- [Container tests use a stub, not a real engine] → Argument construction is covered; an optional manual check
  against a real engine is part of the validation tasks and not a CI gate.
- [`{{NAME}}` throws, which may break a variant whose environment is incomplete] → The error names the variable and
  `{{NAME:-default}}` is the documented escape.

## Migration Plan

1. Land schema and template support (all options optional, existing files valid).
2. Land provisioning, runtime and implode behind the new commands; `provision` and `create` keep their names; `destroy` becomes `implode` in the same step.
3. Update `example/` and the docs, including the mapping table above, so a project can replace its scripts one task
   at a time.

Rollback: revert the change; no data format changed. `variants.local.yaml` runtime sections written by the new
commands remain valid under the existing schema.

## Open Questions

- Whether a later change should let `container` entries share one engine network name across variants for
  cross-variant testing. It does not alter any scenario here.
