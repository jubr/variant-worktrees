## Why

A variant owns one database schema, `v_<slug>`, and `variant` creates that schema itself. A project that serves several tenants from one codebase needs one schema per tenant, created and seeded by the project's own scripts (one run handles every tenant), and removed as a set when the variant goes. Nothing in `variants.yaml` can name that set, so the project keeps its own scripts.

## What Changes

- New `db.multi`: a variant owns one schema per tenant.
  - `schemaPrefix`: the start of every tenant schema. Default `v_${slug}-`, which gives `v_demo-east`.
  - `tenants`: a literal list, such as `east,west`. Or `tenantsCmd`: a shell command, evaluated lazily, whose output parses to that list. One of the two is required.
  - `${multi.tenants}` is the joined list. `${multi.schemaPrefix}` is the prefix with `${slug}` filled in. A step passes both through its own `env`. A YAML anchor can share that `env`.
  - No role setting. The provision script creates any role it needs. With no step named `deprovision`, the builtin drops schemas only. A step named `deprovision` replaces that drop: one run, and the script removes the schemas and anything else.
- `variant.steps` becomes a map keyed by step name. A step has `cmd` (the former `run`), and optional `dir`, `env` and `filterLinesRegex`. A custom step has exactly one of `runBefore` or `runAfter`. **BREAKING** for a `steps` list.
- Provisioning (the schema, and any extra role that may use it) and seeding (tables and rows) are scripts of the project. Each runs once. The script handles every value of the list.
  - A step named `provision` replaces the builtin schema creation.
  - With no such step, the builtin creates the one schema, or every schema of the list.
  - A step named `seed` is the seed. There is no builtin seed.
- The builtin steps, in order, are `create`, `provision`, `seed`, `watch`, `down`, `deprovision`, `implode`. A later step implies the steps above it. `down` is the exception and only stops watches. `deprovision` implies `down`. A step named `deprovision` replaces the builtin drop. With no such step, `deprovision` drops `v_<slug>`, or with `db.multi` every schema under the expanded `schemaPrefix`. `implode` implies `deprovision` and then removes the worktree. Slug `main` is never deprovisioned.
- `watch --reprovision` runs `deprovision` before the implied provision and seed.
- `list` and `status` report a variant once, however many schemas it owns, and name them.
- The guide's Overview, above Core, documents the flow. The README does not gain that section.
- Without `db.multi` and without a step named `provision`, schema creation during `provision` is the builtin `CREATE SCHEMA` of today.

## Capabilities

### New Capabilities

- `variant-config/cfg-multi-schema`: the `db.multi` settings and the `${multi.tenants}` and `${multi.schemaPrefix}` placeholders.
- `variant-api/multi-schema`: the list, the builtin flow, creating and dropping the set, and one record per variant.

### Modified Capabilities

- `variant-config/cfg-provisioning`: `variant.steps` merges on top of the internal builtin steps. `variant config` prints the result. An internal command is `${builtin.step.<name>}`.
- `variant-api/core`: `create` makes the worktree and the state, and does not create a schema.

## Impact

- `variant-config`: `DbMultiSchema` on `db`, the steps map in `schema.ts`, `template.ts`, `variants.yaml.schema.json`, `variants.example.yaml`. The runtime copy of `db` omits `multi`.
- `variant-api`: `db/postgres.ts`, `operations/create.ts`, `operations/implode.ts`, `operations/records.ts`, `provisioning.ts`, `run-context.ts`, a `deprovision` operation, and a list resolver. `down` stays a stop.
- `variant-cli`: `deprovision`, and `--reprovision` on `watch`. `variant-mcp`, `variant-ui`: the schemas of a variant where `target` is shown today.
- `docs/guide/overview.md` (new, linked above Core), `docs/guide/configuration.md`. `README.md` gains the new command and the `db.multi` keys only. `CHANGELOG.md`.
- Non-goals: MySQL and SQLite sets (`db.multi` on another dialect is refused); a list that differs per variant (one `tenants` or `tenantsCmd` for the file); running a script once per value; rewriting a dotenv file. The builtin drop does not remove roles.
