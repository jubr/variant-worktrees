## Why

A variant owns one database schema, `v_<slug>`, and `variant` creates that schema itself. A project that serves several tenants from one codebase needs one schema per tenant, created and seeded by the project's own scripts, and removed as a set when the variant goes. Nothing in `variants.yaml` can name that set, so the project keeps its own scripts.

## What Changes

- New `db.multi`: a variant owns one schema per value of a list that a command prints.
  - `schemasCmd`: a shell command. Its output, such as `TENANT_LIST=east,west,north` read out of a dotenv file, parses to `east`, `west`, `north`.
  - `schemaPattern`: the schema name of one value. Default `{{schema}}-{{multi}}`, which gives `v_<slug>-east`.
  - `env`: templated environment for the per-value runs, such as `TENANT: '{{multi}}'`.
  - `roleSuffix` (optional): the role that belongs to a schema, dropped with it.
- Provisioning (the schema, and any extra role that may use it) and seeding (tables and rows) are scripts of the project, named by the step:
  - A step named `provision` replaces the builtin schema creation. With `db.multi` it runs once per value.
  - With no such step, the builtin runs the equivalent of `CREATE SCHEMA` for the one target, or once per value.
  - A step named `seed` is the seed. There is no builtin seed. With `db.multi` it runs once per value.
- `down` and `implode` deprovision the variant: they drop `v_<slug>`, or, with `db.multi`, every schema matching the pattern with `*` for the value, including a value that has since left the list. `implode` then removes the worktree. Slug `main` is never deprovisioned. **BREAKING** for `down`, which today keeps the database target.
- `list` and `status` report a variant once, however many schemas it owns, and name them.
- The guide documents the lifecycle in the order create, provision, seed, watch, down, implode. The README does not gain that section.
- Without `db.multi` and without a step named `provision`, schema creation is unchanged.

## Capabilities

### New Capabilities

- `variant-config/cfg-multi-schema`: the `db.multi` settings and the `{{multi}}`, `{{multiSchema}}` and `{{dir}}` placeholders.
- `variant-api/multi-schema`: resolving the list, the provision and seed phases, creating and dropping the set, and one record per variant.

### Modified Capabilities

- `variant-api/core`: `create` makes the schema only when no step is named `provision`.
- `variant-api/runtime`: `down` deprovisions the variant instead of keeping its database target.

## Impact

- `variant-config`: `DbMultiSchema` on `db`, `template.ts`, `variants.yaml.schema.json`, `variants.example.yaml`. The runtime copy of `db` omits `multi`.
- `variant-api`: `db/postgres.ts`, `operations/create.ts`, `operations/down.ts`, `operations/implode.ts`, `operations/records.ts`, `provisioning.ts`, `run-context.ts`, and a list resolver.
- `variant-cli`, `variant-mcp`, `variant-ui`: the schemas of a variant where `target` is shown today.
- `docs/guide/core.md` and `docs/guide/configuration.md`. `README.md` gains the `db.multi` keys only. `CHANGELOG.md`.
- Non-goals: MySQL and SQLite sets (`db.multi` on another dialect is refused); a list that differs per variant (it comes from the primary checkout); rewriting the dotenv file; running any step other than `provision` and `seed` once per value.
