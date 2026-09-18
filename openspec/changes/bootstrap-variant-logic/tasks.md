## 1. Setup

- [ ] 1.1 Archive existing BuiltWith code under `_archive/builtwith/` and verify files moved
- [ ] 1.2 Install dependencies (`kysely`, `cleye`, `zod@4`) in root and verify lockfile updated
- [ ] 1.3 Create `packages/variant-config/` structure (src/, test/, package.json, tsconfig.json) and verify `bun run build` compiles

## 2. variant-config package

- [ ] 2.1 Define `variants.yaml` Zod schema in `src/schema.ts` and verify schema exports expected types
- [ ] 2.2 Implement mise env autodetection in `src/autodetect.ts` (read mise.local.toml, fallback to process.env) and verify test with fixture mise.local.toml returns correct values
- [ ] 2.3 Implement config parser in `src/index.ts` (merge mise/env/explicit) and verify test with mock config resolves db.* fields
- [ ] 2.4 Add JSON Schema export for editor autocomplete and verify variants.yaml.schema.json generated
- [ ] 2.5 Write tests for validation errors (missing field, invalid type) and verify error messages include field name

## 3. variant-api core operations

- [ ] 3.1 Create `packages/variant-api/src/client.ts` with `createClient(config)` and verify typed client instance
- [ ] 3.2 Implement Kysely Postgres adapter in `src/db/postgres.ts` (create/drop schema, dialect detection) and verify integration test creates `v_test` schema
- [ ] 3.3 Implement Kysely SQLite adapter in `src/db/sqlite.ts` (create/drop database file) and verify integration test creates `.cache/variants/test.db`
- [ ] 3.4 Implement multi-DB strategy dispatch in `src/db/index.ts` (Postgres → schema, SQLite → file, unsupported → error) and verify correct adapter chosen per connection string
- [ ] 3.5 Implement `create()` operation in `src/operations/create.ts` (delegate to adapter, write state) and verify creates schema + YAML state
- [ ] 3.6 Implement `destroy()` operation in `src/operations/destroy.ts` (drop schema, clear state, main protection) and verify refuses slug `main`
- [ ] 3.7 Implement `list()` operation in `src/operations/list.ts` (merge YAML state + DB schemas) and verify inventory includes all variants
- [ ] 3.8 Implement `switch()` operation in `src/operations/switch.ts` (cd to worktree) and verify cwd changes

## 4. Slug resolution and worktree coupling

- [ ] 4.1 Implement git worktree slug resolution in `src/slug.ts` (primary → `main`, feature → kebab) and verify test with mock `git worktree list` output
- [ ] 4.2 Implement `ensure_worktree()` in `src/worktree.ts` (create sibling `_v-<slug>` on `feat/<slug>`) and verify creates worktree + checks out branch
- [ ] 4.3 Add `--slug` CLI flag override and verify explicit slug bypasses git detection

## 5. State persistence

- [ ] 5.1 Implement YAML state writer in `src/state.ts` (write slug, schema, timestamp, worktree to `.cache/variants/<slug>.yaml`) and verify yq can read result
- [ ] 5.2 Implement JSON→YAML migration and verify converts legacy `.json` files to `.yaml`

## 6. Command definitions

- [ ] 6.1 Rewrite `src/commands.ts` from BuiltWith pattern to variant lifecycle commands and verify `CommandDefinition[]` includes `create`, `destroy`, `list`, `switch`, `provision`, `config`
- [ ] 6.2 Add `ArgDefinition` schemas for each command (slug arg for create/destroy/switch, no args for list/config) and verify args have name/description/type/required

## 7. CLI with cleye

- [ ] 7.1 Implement CLI entry in `src/cli.ts` (cleye router from `commands[]`) and verify `variant --help` lists commands
- [ ] 7.2 Wire arg parsing (map cleye argv to execute() args) and verify `variant create --slug test` calls execute with correct args
- [ ] 7.3 Add `config` command implementation (print detected config as JSON) and verify `variant config` outputs db/variants sections
- [ ] 7.4 Test CLI smoke test sequence (config → create → list → destroy) and verify each command succeeds

## 8. variant-mcp rewrite

- [ ] 8.1 Remove `variant_free` tool from `src/mcp.ts` and verify old tool no longer listed
- [ ] 8.2 Implement `variant_list` MCP tool (calls `list()`) and verify MCP client receives variant array
- [ ] 8.3 Implement `variant_create` MCP tool (calls `create()` with slug arg) and verify creates variant + returns state
- [ ] 8.4 Implement `variant_destroy` MCP tool (calls `destroy()` with slug arg) and verify drops schema + clears state
- [ ] 8.5 Implement `variant_switch` MCP tool (calls `switch()` with slug arg) and verify changes cwd
- [ ] 8.6 Implement `variant_provision` MCP tool (runs config `seed` command with variant env) and verify executes seed + returns output
- [ ] 8.7 Write MCP integration test (mock MCP client lifecycle flow) and verify create → list → destroy sequence

## 9. Reference test porting

- [ ] 9.1 Port slug sanitize/resolve checks from `variants-slug.test.sh` to `variant-api/test/slug.test.ts` and verify kebab-case normalization
- [ ] 9.2 Port state storage checks from `variants-storage.test.sh` to `variant-api/test/state.test.ts` and verify JSON→YAML migration
- [ ] 9.3 Port worktree creation guards from `variants-worktree.test.sh` to `variant-api/test/worktree.test.ts` and verify main-schema protection

## 10. Documentation

- [ ] 10.1 Update AGENTS.md (replace BuiltWith description with variant lifecycle) and verify describes new packages
- [ ] 10.2 Write VitePress user guide at `docs/guide.md` (workspace setup, variants.yaml config, CLI usage) and verify docs build succeeds
- [ ] 10.3 Generate TypeDoc API reference and verify public surface documented

## 11. Verification gates

- [ ] 11.1 Run `task lint` and verify no Biome errors
- [ ] 11.2 Run `task test` and verify all tests pass
- [ ] 11.3 Run `task build` and verify workspace builds cleanly
- [ ] 11.4 Run `openspec validate --all --strict --no-interactive` and verify change passes
- [ ] 11.5 Run `openspec doctor --json` and verify no issues
