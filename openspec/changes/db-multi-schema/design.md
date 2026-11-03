## Context

- A PostgreSQL variant is one schema. `PostgresAdapter` maps a slug to `v_<slug>`, `create` and `destroy` act on that one name, and `list` returns every schema that starts with `v_`. `prepareRun` puts the target into `POSTGRES_SCHEMA`, `VARIANT_TARGET` and `{{schema}}`.
- `create` always runs `CREATE SCHEMA`. Provisioning then runs one pipeline: installs, env copies, `up` commands, `variant.steps` in list order, then `variant.seed`, each once. Command text is not templated; `env` values are.
- `down` stops processes and containers and keeps the database target. `implode` drops it and removes the worktree.
- See proposal.md for motivation.

## Goals / Non-Goals

**Goals:**
- The project owns provisioning and seeding. `variant` runs them, and falls back to `CREATE SCHEMA` only when the project has no provision script.
- A variant can own one schema per value of a list, and deprovision removes the whole set.
- The guide states the six phases in a fixed order. The README does not.

**Non-Goals:**
- MySQL and SQLite sets. A list that differs per variant. Per-value runs of steps other than `provision` and `seed`. Rewriting a dotenv file.

## Decisions

### The step name selects the script

Provisioning is the schema plus any extra role that may connect to it. Seeding is tables and rows. Both are scripts in the target project, and the step name is the whole contract: `provision` and `seed`. No new flag. A step with any other name runs once, in the phase between those two. Rejected: a `multi: true` flag, which would be a second way to say the same thing, and running every step once per value, which repeats migrations and installs.

The phases run in lifecycle order even when the steps are listed differently. `provision` runs in the provision phase, `seed` in the seed phase, and the rest keep their relative order in between. `variant.seed` stays what the current spec says: one command after the steps, not once per value. A project that seeds per value uses the step and leaves `variant.seed` unset. When `VARIANT_STEP_PROVISION=no`, the builtin does not create a schema either, because the project asked for no provisioning.

### Naive creation is the absence of the script

With no step named `provision`, the builtin runs `CREATE SCHEMA` for the target, or once per value. It does not create roles. With the step present, the builtin creates nothing and the script does, seeing `POSTGRES_SCHEMA`, `VARIANT_MULTI` and `db.multi.env` for that value. The script is free to create the role; `variant` only learns the role's suffix so deprovision can drop it.

### `{{ }}` and the schema stem

The configuration has one template syntax, so the new placeholders are `{{multi}}`, `{{multiSchema}}` and `{{dir}}`. The default pattern is `{{schema}}-{{multi}}`. `{{schema}}` is `v_<slug>` with `_` for hyphens, which gives `v_demo-east` and keeps the `v_` prefix that the drop guards and `list` rely on. A pattern built on `{{slug}}` would produce `demo-east`, which no guard can tell from a schema of the primary checkout.

### The list comes from the primary checkout

`schemasCmd` runs in the project directory of the primary checkout, and `{{dir}}` is that path. The values are needed before the variant worktree has its copy of a gitignored env file. Parsing splits on commas and whitespace, strips one pair of quotes, drops empties and repeats, and requires `^[A-Za-z0-9_-]+$`. An empty result is an error. A file that may lack the line puts the default in the command (`... | grep . || echo main`).

### Deprovision matches the pattern, not the list

`down`, `implode` and the vanished-checkout path drop by pattern: `{{schema}}` becomes the escaped target, literal parts are escaped (`\`, `%`, `_`), `{{multi}}` becomes `%`. The target ends where the next literal begins, so `v_foo-%` cannot match `v_foo_bar-east`, and escaped underscores keep `v_fooxbar-` out. `schemasCmd` is not run, so a missing env file still leaves a clean database, and a value removed from the list leaves no schema. `down` stops there. `implode` then deletes storage, clears state and removes the worktree, as it does today. Slug `main` is never dropped.

This changes `down` for every dialect: a non-`main` variant loses its database target. Storage and the state file stay, so the next `watch` can provision again.

Roles are derived from the schemas actually dropped, never from a pattern over role names: `<schema with - as _><roleSuffix>`, `DROP OWNED BY` then `DROP ROLE`, when the suffix is set and the role exists.

### Where the code changes

`DatabaseAdapter.create(slug, values?)` creates one schema per value when given values and no provision step, otherwise the one target as today. `destroy(slug)` on a `PostgresAdapter` built with `db.multi` drops by pattern. `list()` still returns raw names; `groupMultiSchemas(names, pattern)` groups them and is what `collectRecords` calls. `createVariant`, `prepareVariant` and `provisionVariant` call `resolveMultiValues` once. `down` calls `destroy` and does not resolve the list. The dialect check happens where the client builds the adapter.

`runProvisioning` grows one helper, `runForValues`, used by the two named steps. `VariantRun` carries the resolved values. The environment order is the existing one with the per-value variables and `db.multi.env` inserted before the step's own `env`.

### Example

```yaml
db:
  dialect: postgres
  schema: app # the primary checkout: schema app, not a set
  multi:
    schemasCmd: sed -nr 's/^TENANT_LIST=(.*)$/\1/p' {{dir}}/server/.env
    roleSuffix: _app
    env:
      TENANT: '{{multi}}'
      SCHEMA_PREFIX: '{{schema}}-'
variant:
  steps:
    - name: provision # creates the schema and the role; suppresses CREATE SCHEMA
      run: bun run db:provision
      dir: server
    - name: report # runs once
      run: bun run db:report
      dir: server
    - name: seed # tables and rows, once per value
      run: bun run db:seed
      dir: server
```

With `TENANT_LIST=east,west`, provisioning runs `db:provision` for `east` then `west`, then `db:report` once, then `db:seed` for `east` then `west`. Each per-value run sees `TENANT=east` (or `west`) and `SCHEMA_PREFIX=v_demo-`. `down` then drops `v_demo-east`, `v_demo-west` and a leftover `v_demo-north`, plus the roles `v_demo_east_app`, `v_demo_west_app` and `v_demo_north_app`.

## Risks / Trade-offs

- [A valid pattern matches schemas of another tool] → the pattern must start with the variant's own `v_<slug>` target, and the drop is a `LIKE` with escaped literals. Tests assert that `v_demo_two-*`, `v_demox-*` and `app-*` survive.
- [The primary checkout's list differs from the copy in the worktree] → documented. Creation and the per-value runs use the primary list. Deprovision ignores lists.
- [`down` now drops data] → called out as breaking. Storage and state survive, and `watch` provisions again. `main` is excluded.
- [A project whose seed script already loops over every tenant] → the per-value environment carries the one value, and the script can limit itself to it. A script that has no such limit belongs in a step with another name, which runs once.
- [`N` sequential runs] → sequential so a failure stops at a named value.

## Migration Plan

A configuration with no `db.multi` and no step named `provision` keeps today's schema creation. Adding the step opts out of `CREATE SCHEMA`. `down` drops the database target on the version that ships this change; projects that relied on `down` keeping data use `watch` to come back, which recreates and reseeds, or avoid `down`. Rollback is the previous release. Schemas named `v_<slug>-<value>` remain ordinary schemas.

## Open Questions

- Whether a variant should name its own list (`variants.<slug>.multi`). It would add a key and change nothing else.
- Whether `schemasCmd` should have an `env` of its own. Today it sees the process environment only.
