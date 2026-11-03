## 1. Configuration

- [ ] 1.1 Red: `variant-config` specs for "Multi-schema settings" (defaults, missing command, pattern without `{{multi}}`, pattern not starting with `{{schema}}`, unsafe characters, `roleSuffix`)
- [ ] 1.2 Add `DbMultiSchema` to `DbConfigSchema`, default the pattern, and omit `multi` from `RuntimeDbSchema`
- [ ] 1.3 Red/green: `renderTemplate` renders `{{multi}}` and `{{multiSchema}}` (empty outside a per-value run) and `schemasCmd` renders `{{dir}}`
- [ ] 1.4 Regenerate `variants.yaml.schema.json` and add `db.multi` to `variants.example.yaml`
- [ ] 1.5 Commit the task group (code and tests)

## 2. Pure helpers

- [ ] 2.1 Red/green: `parseMultiList` (separators, quotes, empties, repeats, invalid value) in `variant-config`
- [ ] 2.2 Red/green: `multiSchemaName`, `multiLikePattern` (escapes `\`, `%`, `_`; `v_foo-%` never covers `v_foo_bar-east` or `v_fooxbar-east`) and `groupMultiSchemas` (hyphenated slug, no state, other `v_` names ignored)
- [ ] 2.3 Commit the task group

## 3. Database adapter

- [ ] 3.1 Red: adapter tests for "Schemas of a variant" (one schema per value, existing data kept, custom pattern) and "Deprovision drops every schema of the variant" (value left the list, other slugs and `app-*` stay, underscore literal, roles with and without `roleSuffix`)
- [ ] 3.2 `DatabaseAdapter.create(slug, values?)`; `PostgresAdapter` creates a schema per value and drops by pattern, with the roles of the dropped schemas; the adapter re-validates the pattern
- [ ] 3.3 Refuse `db.multi` with a dialect other than PostgreSQL where the client builds its adapter
- [ ] 3.4 Commit the task group

## 4. Provision and seed phases

- [ ] 4.1 Red: the scenarios of "Provision and seed are project scripts" (builtin when no provision step, script instead of builtin, seed per value, another step once, variables, `db.multi.env`, step env wins, phase order, failure names the value, skipped provision creates nothing, no builtin seed, no `db.multi`)
- [ ] 4.2 `resolveMultiValues` runs `schemasCmd` in the primary project directory. `create`, `up`, `watch` and `provision` resolve once. The provision phase is the builtin or the `provision` step, then the other steps, then the `seed` step, then `variant.seed` once
- [ ] 4.3 Red/green: "Create schema variant" (no schema when a step is named `provision`; schema as before otherwise) and "Multi list resolution" (dotenv list, quotes and repeats, primary checkout, failing command, no value, invalid value)
- [ ] 4.4 Commit the task group

## 5. Deprovision

- [ ] 5.1 Red: "Down" (target dropped after watch and after up, storage and state kept, `main` kept) and the drop scenarios of "Deprovision" including a `down` whose `schemasCmd` file is gone
- [ ] 5.2 `down` drops the target for a slug other than `main` and keeps storage and state. With `db.multi` the drop is the whole set, and it does not run `schemasCmd`. `implode` and the vanished-checkout path use the same drop
- [ ] 5.3 Commit the task group

## 6. Records and output

- [ ] 6.1 Red: "One record per variant" (three schemas one record, hyphenated slug, no `schemas` without `db.multi`)
- [ ] 6.2 `VariantRecord.schemas`; `collectRecords` groups with `groupMultiSchemas`. The record schema, JSON and YAML output, the MCP tools and the `variant-ui` record type carry the field. Text `list` stays one line per variant; `status` and `list --verbose` print the schemas
- [ ] 6.3 Commit the task group

## 7. Guide

- [ ] 7.1 `docs/guide/core.md`: the lifecycle section, the six phases in the order create, provision, seed, watch, down, implode, with the wording the "Lifecycle in the guide" requirement fixes. No such section in `README.md`
- [ ] 7.2 `docs/guide/configuration.md`: `db.multi`, the placeholders, and the example with `TENANT_LIST`, a step named `provision` and a step named `seed`. `README.md` lists the new keys only. `CHANGELOG.md` under Unreleased
- [ ] 7.3 The guide scenarios pass, and `scripts/docs-coverage.spec.ts` passes
- [ ] 7.4 Commit the task group

## 8. Verification

- [ ] 8.1 `openspec validate --all --strict --no-interactive` and `openspec doctor --json` succeed
- [ ] 8.2 `task check:full` succeeds locally
