## Context

- A PostgreSQL variant is one schema. `PostgresAdapter` maps a slug to `v_<slug>`. `create` runs `CREATE SCHEMA` and makes the worktree. `down` stops processes and keeps the schema. `implode` drops the schema and removes the worktree.
- `variant.steps` is a list of `{ name, run }`. Provisioning runs installs, env copies, `up` commands, the steps in list order, then `variant.seed`, each once.
- See proposal.md for motivation.

## Goals / Non-Goals

**Goals:**

- The project owns provisioning and seeding. Each script runs once and handles every schema. `variant` falls back to `CREATE SCHEMA` only when the project has no provision script.
- The builtin steps have one order, and a later step implies the ones above it, with `down` only stopping watches.
- A custom step names its place with `runBefore` or `runAfter`.
- The Overview page states that flow. The README does not.

**Non-Goals:**

- MySQL and SQLite sets. A list that differs per variant. Running a script once per value. Rewriting a dotenv file.

## Decisions

### One run, and the script handles the list

The provision script and the seed script each run once, whether or not `db.multi` is set. The builtin, when there is no step named `provision`, creates every schema of the list itself: `schemaPrefix` with `${slug}` filled in, then the tenant. The script reads the list and the prefix from its own environment. The example sets `MULTI_TENANT_LIST: ${multi.tenants}` and `MULTI_SCHEMA_PREFIX: ${multi.schemaPrefix}`, and a YAML anchor (`&prov-env`, `*prov-env`) shares that map between `provision`, `seed` and any later step. The script already knows how to walk its own list. Rejected: one process per value, which forces the project to accept a value it never asked to be called with, and which repeats work the script already loops over.

`${multi.tenants}` is the joined list. It is filled lazily, the first time a step expands it or the builtin needs the names, and then reused. The builtin schema drop does not expand it. A step that does not expand it sees nothing. `${multi.schemaPrefix}` is `schemaPrefix` with its placeholders filled in, and it does not run the command. `schemaPrefix` is the project's string. It defaults to `v_${slug}-` and is not required to start with `v_`, to contain `${slug}`, or to end with a separator. There is no `roleSuffix`.

### The step name selects the script, and the map replaces the list

`variant.steps` is a map keyed by name, with `cmd` instead of `run`. The builtin steps are an internal map, in flow order, and each internal command is `${builtin.step.create}`, `${builtin.step.provision}`, `${builtin.step.seed}`, `${builtin.step.watch}`, `${builtin.step.down}`, `${builtin.step.deprovision}` or `${builtin.step.implode}`. That token is the builtin implementation, not a shell command. `variant.steps` merges on top: a user `cmd` replaces the token, a missing `cmd` keeps it, and `env` merges with the user key winning. `variant config` prints the merged map as `variant.steps`. `provision`, `seed` and `deprovision` fill those phases. Every builtin step has a fixed position, so `runBefore` and `runAfter` on one of them fail validation. Every other name is a custom step and requires exactly one of `runBefore` and `runAfter`. `runAfter: seed` places it immediately after the seed phase. Neither key fails validation, and both keys fail validation. A name is `[A-Za-z0-9_-]{2,20}`, which is what the example comment already says.

A `run` key with no `cmd` is read as `cmd` and warned about, so an old step keeps its command. A list is rejected: a silent reshape would hide a bad edit. This is breaking for a committed `steps` list, and the example file is updated in the same change.

### Implication runs downward from the command

The order is `create`, `provision`, `seed`, `watch`, `down`, `deprovision`, `implode`. Invoking one runs the builtin steps above it. `watch` therefore creates, provisions and seeds. `down` is the break in that chain: it only stops watches, and the schemas stay. `deprovision` implies `down` and then runs the deprovision phase. A `cmd` on the step named `deprovision` replaces the builtin drop. With no such command, the phase drops the schemas. `implode` implies `deprovision` and then removes the worktree. `up` implies `seed` and then starts containers.

`watch --reprovision` runs `deprovision` before the provision phase, so the schemas are dropped and created again. Without the flag, `watch` does not drop.

### Deprovision matches the pattern, not the list

The builtin drop matches the expanded `schemaPrefix` plus anything. For `v_${slug}-` and slug `demo` that is `v_demo-*`. `_` and `%` in the prefix are escaped, so the match is literal. `tenantsCmd` is not run for that drop, so a missing env file still leaves a clean database, and a value removed from the list leaves no schema. The builtin drops schemas only.

A step named `deprovision` replaces the builtin drop, on the same terms as `provision`: one run, and the script handles every tenant. The script removes the schemas and anything else, such as a role. With no such step, the builtin drops schemas only and leaves roles. `VARIANT_STEP_DEPROVISION=no` skips that step and does not fall back to the builtin drop.

`create` no longer touches the database. The schema appears at `provision`, which `watch` implies. Existing callers of `create` that expected a schema now need `provision`.

### Example

```yaml
db:
  dialect: postgres
  host: 127.0.0.1
  multi:
    schemaPrefix: v_${slug}-
    #tenants: east,west
    tenantsCmd: sed -rn ${worktree}/${dir}/.env -e 's/^WITCHES=(.*)$/\1/p' # lazy evaluation

variant:
  steps:
    provision: # one run; creates every schema and any users/roles it may need
      cmd: bun run db:provision:witches
      dir: server
      env: &prov-env
        MULTI_TENANT_LIST: ${multi.tenants} # populated by multi.tenantsCmd
        MULTI_SCHEMA_PREFIX: ${multi.schemaPrefix} # cmd creates 'v_${slug}-east' + west
    seed: # one run; the seeds every tenant schema
      cmd: bun run db:seed:witches
      dir: server
      env: *prov-env
    migrations:
      cmd: bun run migrate
      dir: server
      env: *prov-env
      runAfter: seed
    deprovision: # one run; replaces the builtin schema drop
      cmd: bun run db:deprovision:witches
      dir: server
      env: *prov-env
```

So with `slug=demo` and `.env` containing `WITCHES=east,west`, `watch` runs `db:provision:witches` once with `MULTI_TENANT_LIST=east,west` and `MULTI_SCHEMA_PREFIX=v_demo-`, then `db:seed:witches` once with the same vars, then `migrations` once. `deprovision` runs `db:deprovision:witches` once with the same vars and drops nothing itself. The script removes `v_demo-east`, `v_demo-west`, a leftover `v_demo-north` and any role.

## Risks / Trade-offs

- [A prefix matches schemas of another variant] → the project chooses `schemaPrefix`. The drop escapes `\`, `%` and `_`. A prefix that omits the slug can match more than one variant.
- [The worktree's list differs from the primary checkout] → `tenantsCmd` names the file. `${worktree}` is the variant worktree, which exists before provision. Deprovision ignores lists.
- [`create` no longer creates a schema] → `watch` and `provision` do. Callers of `create` alone get a worktree and no database.
- [A `steps` list no longer loads] → the error names the key. `run` on a map entry still works, with a warning.
- [A script that cannot walk the list itself] → it reads `MULTI_TENANT_LIST`, which the step sets to `${multi.tenants}`. A project that wants one process per value is out of scope.

## Migration Plan

Configurations with no `steps` and no `db.multi` keep today's `CREATE SCHEMA`, now at `provision` rather than `create`. A `steps` list is edited into a map. `down` keeps its meaning. Rollback is the previous release.

## Open Questions

- Whether a variant should name its own list (`variants.<slug>.multi`). It would add a key and change nothing else.
- Whether `tenantsCmd` should have an `env` of its own. Today it sees the process environment only.
