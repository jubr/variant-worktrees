## 1. Steps map

- [ ] 1.1 Red: the scenarios of "Provisioning steps" and "Resolved steps" (map form, colliding segments, bad name, length, a builtin name overlays, regex, former keys, `run` read as `cmd`, a list rejected, `runBefore`/`runAfter` known, unknown, both, neither, self, and refused on a builtin step; `variant config` prints `${builtin.step.<name>}` and a user `cmd` on top)
- [ ] 1.2 `variant.steps` is a map merged on top of the internal steps. `cmd` is the command. `run` migrates to `cmd` with a warning. Validate `runBefore` and `runAfter`
- [ ] 1.3 Regenerate `variants.yaml.schema.json`. `variants.example.yaml` uses the map, with the `migrations` step and `runAfter: seed`
- [ ] 1.4 Commit the task group

## 2. Configuration of the set

- [ ] 2.1 Red: "Multi-schema settings" and the placeholder scenarios (`${multi.tenants}` is the joined list, lazy; `${multi.schemaPrefix}` does not run the command; empty without `db.multi`; `${worktree}` in `tenantsCmd`; a YAML env anchor)
- [ ] 2.2 `DbMultiSchema` on `db`: exactly one of `tenants` and `tenantsCmd`, default `schemaPrefix` `v_${slug}-`, omitted from the runtime copy of `db`. `renderTemplate` gains `${multi.tenants}` and `${multi.schemaPrefix}`
- [ ] 2.3 Red/green: `parseMultiList`, `multiSchemaName`, `multiLikePattern`, `groupMultiSchemas`
- [ ] 2.4 Commit the task group

## 3. Provision and seed, once

- [ ] 3.1 Red: "Provision and seed run once" (builtin schemas, provision script once, seed script once, the list in the environment, step env wins, `runAfter: seed`, failure names the step, skipped provision creates nothing, no builtin seed, no `db.multi`)
- [ ] 3.2 Red: "Create schema variant" creates the worktree and no schema. "Schemas of a variant" and "Multi list resolution"
- [ ] 3.3 `resolveMultiValues` reads `tenants` or runs `tenantsCmd` once, lazily. The builtin creates `schemaPrefix` plus each tenant when no step is named `provision`. The two scripts run once. The step `env` supplies `MULTI_TENANT_LIST` and `MULTI_SCHEMA_PREFIX`
- [ ] 3.4 Commit the task group

## 4. Flow, deprovision, reprovision

- [ ] 4.1 Red: "Builtin flow" (watch implies the steps above, down keeps the schema, deprovision implies down, implode implies deprovision, main kept) and "Reprovision"
- [ ] 4.2 Red: "Deprovision drops every schema of the variant" (a value that left the list, other slugs, a literal underscore, a hyphen kept in the slug, a role left in place, a missing `tenantsCmd` file)
- [ ] 4.3 `deprovision` stops the watches. A step named `deprovision` with a `cmd` runs once and replaces the builtin drop. With no such command, the builtin drops the target, or every schema under the expanded `schemaPrefix`, without running `tenantsCmd` for that drop and without dropping roles. `VARIANT_STEP_DEPROVISION=no` skips the step and does not fall back to the builtin drop. `implode` runs it and then removes the worktree. `watch --reprovision` runs it before the provision phase. `down` does not drop
- [ ] 4.4 The command, the CLI, the MCP tool and the help list `deprovision` and `--reprovision`
- [ ] 4.5 Commit the task group

## 5. Records

- [ ] 5.1 Red: "One record per variant"
- [ ] 5.2 `VariantRecord.schemas`. Text `list` stays one line per variant. `status` and `list --verbose` print the schemas. JSON, YAML, MCP and the `variant-ui` record carry the field
- [ ] 5.3 Commit the task group

## 6. Guide

- [ ] 6.1 `docs/guide/overview.md` matches "Lifecycle in the guide", and the sidebar lists Overview above Core. `docs/guide/configuration.md` shows `db.multi` and the steps map. `README.md` lists `deprovision`, `--reprovision` and the new keys, and has no `Flow of Steps` heading. `CHANGELOG.md` under Unreleased
- [ ] 6.2 `scripts/docs-coverage.spec.ts` passes
- [ ] 6.3 Commit the task group

## 7. Verification

- [ ] 7.1 `openspec validate --all --strict --no-interactive` and `openspec doctor --json` succeed
- [ ] 7.2 `task check:full` succeeds locally
