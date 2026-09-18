## 1. Setup

- [x] 1.1 Delete existing BuiltWith code and remove its package/API references; verify no BuiltWith or `free` traces remain
- [x] 1.2 Install dependencies (`drizzle-orm`, `postgres`, `mysql2`, `yaml`, `smol-toml`, `cleye`, `zod@4`) in root and verify lockfile updated
- [x] 1.3 Create `packages/variant-config/` structure (src/, `test/config.test.ts`, package.json, tsconfig.json), start test file with `import { describe, expect, it } from "bun:test";`, and verify `bun run build` compiles

## 2. variant-config package

- [x] 2.1 Define `variants.yaml` Zod schema in `src/schema.ts` and verify schema exports expected types
- [x] 2.2 Implement mise env autodetection in `src/autodetect.ts` (read mise.local.toml first, then process.env) and verify `test/autodetect.test.ts` uses `import { describe, expect, it } from "bun:test";` and returns correct values with fixture mise.local.toml
- [x] 2.3 Implement config parser in `src/index.ts` (merge mise/env/explicit) and verify `test/config.test.ts` uses `import { describe, expect, it } from "bun:test";` and resolves db.* fields
- [x] 2.4 Add JSON Schema export for editor autocomplete and verify variants.yaml.schema.json generated
- [x] 2.5 Write validation tests in `test/schema.test.ts` (missing field, invalid type), including `import { describe, expect, it } from "bun:test";`, and verify error messages include field name
- [x] 2.6 Implement runtime instance resolution (explicit `variant.instances[]` first, otherwise search subdirectories from the directory containing `variants.yaml` for Vite/NestJS) and verify `test/instances.test.ts` includes `import { describe, expect, it } from "bun:test";` plus precedence and autodetection cases
- [x] 2.7 Add `variant.root` schema and autodetection (parent `AGENTS.md` symlink, then git carrying directory) and verify `test/root.test.ts` imports `describe`, `expect`, and `it` from `bun:test`

## 3. variant-api core operations

- [x] 3.1 Create `packages/variant-api/src/client.ts` with `createClient(config)` and verify `test/client.test.ts` starts with `import { describe, expect, it } from "bun:test";` and returns a typed client instance
- [x] 3.2 Implement Drizzle Postgres adapter in `src/db/postgres.ts` (create/drop schema, dialect detection) and verify `test/postgres.test.ts` creates `v_test` schema
- [x] 3.3 Implement Drizzle Bun SQLite adapter in `src/db/sqlite.ts` (create/drop database file) and verify `test/sqlite.test.ts` creates `.cache/variants/test.db`
- [x] 3.4 Implement multi-DB strategy dispatch in `src/db/index.ts` (Postgres → schema, SQLite → file, unsupported → error) and verify `test/db.test.ts` chooses correct adapter per connection string
- [x] 3.5 Implement `create()` operation in `src/operations/create.ts` (delegate to adapter, write state) and verify `test/operations.test.ts` creates schema + YAML state
- [x] 3.6 Implement `destroy()` operation in `src/operations/destroy.ts` (drop schema, clear state, main protection) and verify `test/operations.test.ts` refuses slug `main`
- [x] 3.7 Implement `list()` operation in `src/operations/list.ts` (merge YAML state + DB schemas) and verify `test/operations.test.ts` inventory includes all variants
- [x] 3.8 Implement `switch()` operation in `src/operations/switch.ts` (cd to worktree) and verify `test/operations.test.ts` confirms cwd changes; all operation tests import `describe`, `expect`, and `it` from `bun:test`

## 4. Slug resolution and worktree coupling

- [x] 4.1 Implement git worktree slug resolution in `src/slug.ts` (primary → `main`, feature → kebab) and verify `test/slug.test.ts` imports `describe`, `expect`, and `it` from `bun:test` and covers mock `git worktree list` output
- [x] 4.2 Implement `ensure_worktree()` in `src/worktree.ts` (create `_v-<slug>` below resolved `variant.root` on `feat/<slug>`) and verify `test/worktree.test.ts` creates worktree + checks out branch
- [x] 4.3 Add `-s/--slug` override and verify `test/slug.test.ts` confirms explicit slug takes precedence over git detection
- [x] 4.4 Pass resolved `variant.root` through create/provision/switch operations and verify worktree paths use configured root

## 5. State persistence

- [x] 5.1 Implement YAML state writer in `src/state.ts` (write slug, schema, timestamp, worktree to `.cache/variants/<slug>.yaml`) and verify `test/state.test.ts` starts with `import { describe, expect, it } from "bun:test";` and yq can read result
- [x] 5.2 Implement JSON→YAML migration in `test/state.test.ts` and verify it converts legacy `.json` files to `.yaml`

## 6. Command definitions

- [x] 6.1 Rewrite `src/commands.ts` from BuiltWith pattern to variant lifecycle commands and verify `test/commands.test.ts` imports `describe`, `expect`, and `it` from `bun:test` and confirms `CommandDefinition[]` includes `create`, `destroy`, `list`, `switch`, `provision`, `config`
- [x] 6.2 Add `ArgDefinition` schemas for each command (slug arg for create/destroy/switch, no args for list/config) and verify args have name/description/type/required in `test/commands.test.ts`

## 7. CLI with cleye

- [x] 7.1 Implement CLI entry in `src/cli.ts` (cleye router from `commands[]`) and verify `test/cli.test.ts` starts with `import { describe, expect, it } from "bun:test";` and `variant --help` lists commands
- [x] 7.2 Wire arg parsing (map cleye argv to execute() args) and verify `test/cli.test.ts` confirms `variant create --slug test` calls execute with correct args
- [x] 7.3 Add `config` command implementation (print detected config as JSON) and verify `test/cli.test.ts` confirms `variant config` outputs db/variants sections
- [x] 7.4 Test CLI smoke test sequence in `test/cli.test.ts` (config → create → list → destroy) and verify each command succeeds

## 8. variant-mcp rewrite

- [x] 8.1 Remove `variant_free` tool from `src/mcp.ts` and verify `test/mcp.test.ts` starts with `import { describe, expect, it } from "bun:test";` and old tool no longer listed
- [x] 8.2 Implement `variant_list` MCP tool (calls `list()`) and verify `test/mcp.test.ts` receives variant array
- [x] 8.3 Implement `variant_create` MCP tool (calls `create()` with slug arg) and verify `test/mcp.test.ts` creates variant + returns state
- [x] 8.4 Implement `variant_destroy` MCP tool (calls `destroy()` with slug arg) and verify `test/mcp.test.ts` drops schema + clears state
- [x] 8.5 Implement `variant_switch` MCP tool (calls `switch()` with slug arg) and verify `test/mcp.test.ts` changes cwd
- [x] 8.6 Implement `variant_provision` MCP tool (runs config `seed` command with variant env) and verify `test/mcp.test.ts` executes seed + returns output
- [x] 8.7 Write MCP integration test in `test/mcp.test.ts` (mock MCP client lifecycle flow) and verify create → list → destroy sequence

## 9. Reference test porting

- [x] 9.1 Port slug sanitize/resolve checks from `variants-slug.test.sh` to `variant-api/test/slug.test.ts` and verify file imports `describe`, `expect`, and `it` from `bun:test` plus kebab-case normalization
- [x] 9.2 Port state storage checks from `variants-storage.test.sh` to `variant-api/test/state.test.ts` and verify file imports `describe`, `expect`, and `it` from `bun:test` plus JSON→YAML migration
- [x] 9.3 Port worktree creation guards from `variants-worktree.test.sh` to `variant-api/test/worktree.test.ts` and verify file imports `describe`, `expect`, and `it` from `bun:test` plus main-schema protection

## 10. Documentation

- [x] 10.1 Update AGENTS.md (replace BuiltWith description with variant lifecycle) and verify no BuiltWith references remain
- [x] 10.2 Write VitePress user guide at `docs/guide.md` (workspace setup, variants.yaml config, CLI usage) and verify docs build succeeds
- [x] 10.3 Generate TypeDoc API reference and verify public surface documented

## 11. Verification gates

- [x] 11.1 Run `task lint` and verify no Biome errors
- [x] 11.2 Run `task test` and verify all tests pass
- [x] 11.3 Run `task build` and verify workspace builds cleanly
- [x] 11.4 Run `openspec validate --all --strict --no-interactive` and verify change passes
- [x] 11.5 Run `openspec doctor --json` and verify no issues
