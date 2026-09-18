## Context

Reference: the legacy project's `scripts/variants/*.sh` — 700+ lines of Bash managing Postgres schemas, Docker containers, nginx proxies, yq state files, git worktrees. Hard-coded to Postgres, project paths, NestJS/Vite. See proposal.md for why.

Current `variant-api` is BuiltWith free endpoint client. MCP exposes `variant_free`. Pivot to DB variant lifecycle.

## Goals / Non-Goals

**Goals:**
- Generic TypeScript library for any Bun/Node workspace
- Multi-DB support (Postgres schemas, SQLite files, fallback table-prefix)
- Preserve reference state storage (`.cache/variants/*.yaml`, yq compat)
- CLI with cleye, MCP with tool generation, VS Code webview auto-gen from commands
- Worktree coupling optional (explicit flag disables)

**Non-Goals:**
- Container orchestration implementation (hook only — user defines `variant.up` command)
- Migration runner (delegate to workspace via config `seed` command)
- Non-relational DBs (Mongo, Redis)

## Decisions

### DB abstraction library: Drizzle ORM

**Chosen:** Drizzle ORM with Bun SQLite, Postgres-js, and MySQL drivers
**Why:** Type-safe multi-dialect API with a native Bun SQLite driver and established Postgres/MySQL drivers. One adapter contract hides driver details while retaining dialect-specific schema/database operations.

**Alternatives:**
- Kysely: strong query builder, but no native Bun SQLite driver
- node-postgres: Postgres-only
- Raw SQL: dialect differences error-prone

### Config file: variants.yaml with JSON Schema

**Chosen:** YAML + JSON Schema validation via Zod
**Why:** Reference uses YAML. Zod v4 strict mode matches existing pattern. JSON Schema export for editor autocomplete.

**Alternatives:**
- TypeScript config: no runtime validation
- JSON: less human-friendly

### State storage: yq-compatible YAML

**Chosen:** Preserve `.cache/variants/<slug>.yaml` format, read/write with Bun native YAML
**Why:** Reference migration expects yq compat. Bun has native YAML parser. Avoids yq subprocess dependency.

**Alternatives:**
- JSON: breaks reference migration
- SQLite state: overkill for key-value

### Slug resolution: explicit override + git detection

**Chosen:** Use `-s`/`--slug` when supplied; otherwise try `git worktree list`, parse branch, and strip `feat/`/`fix/`
**Why:** Matches reference `variants-slug.sh`. Primary worktree → `main`. Feature worktrees → kebab slug.

**Alternatives:**
- Explicit only: lose auto-detect convenience
- Branch-only: doesn't handle primary worktree

### Variant worktree root: explicit config, then AGENTS/git-root autodetection

**Chosen:** Use `variant.root` when configured, resolved relative to `variants.yaml`. Otherwise, if the parent directory contains an
`AGENTS.md` symlink, resolve its target and use that target's directory. If no such symlink exists, use the git common/carrying
directory and the directory containing its real `AGENTS.md`. Place `_v-$slug` worktrees directly under the resolved root.
**Why:** Workspaces may live beside a main checkout while sharing contributor guidance through an `AGENTS.md` symlink. Ordinary
worktrees should keep variant directories beside the real repository guidance file, even when `.git` is a worktree indirection file.

**Alternatives:**
- Always use `dirname(primaryWorktree)`: puts variants outside the repository when the main worktree owns `AGENTS.md`
- Require `variant.root`: loses safe convention-based defaults

### Multi-DB strategy: hybrid

**Chosen:** Schema-per-variant (Postgres/MySQL), database-per-variant (SQLite), error for unsupported
**Why:** User chose hybrid. Postgres/MySQL have first-class schema support. SQLite file-per-variant matches reference pattern (though reference doesn't use SQLite).

**Alternatives:**
- Schema-only: breaks SQLite
- Database-only: wastes Postgres schema isolation
- Table-prefix: complex, name-collision risk

### Command pattern: port cli-vscode-webview.md

**Chosen:** `CommandDefinition[]` in `variant-api/commands.ts`, `cleye` CLI router, MCP tool generator, VS Code webview auto-gen
**Why:** Existing doc defines pattern. Zero duplication. Type-safe end-to-end.

**Alternatives:**
- Separate CLI/MCP impls: duplication
- commander/yargs: imperative, heavy

### Runtime orchestration: config-first instance discovery

**Chosen:** Use explicit `variant.instances[]` entries from `variants.yaml` when present. Otherwise search subdirectories starting at the directory containing `variants.yaml` and detect `vite` or `nestjs` instances. Execute configured `variant.up` and `variant.watch` commands as workspace hooks.
**Why:** User wants abstract hooks without hard-coding Docker, Bun, or framework paths. Explicit config remains authoritative; autodetection supports conventional Vite/NestJS workspaces.

**Alternatives:**
- Built-in Docker: couples library to containers
- No hooks: variant provision incomplete

## Package structure

```
packages/
  variant-config/
    src/
      schema.ts        # Zod schema for variants.yaml
      autodetect.ts    # mise → env detection
      index.ts         # parse + validate
    test/
  variant-api/
    src/
      client.ts        # createClient(config)
      operations/      # create, destroy, list, switch
        create.ts
        destroy.ts
        list.ts
        switch.ts
      db/              # Drizzle-backed adapters
        postgres.ts
        sqlite.ts
      slug.ts          # git worktree resolution
      state.ts         # YAML state persistence
      worktree.ts      # ensure_worktree logic
      commands.ts      # CommandDefinition[] (rewrite from BuiltWith free)
      index.ts
    test/
  variant-mcp/
    src/
      mcp.ts           # MCP server (rewrite from variant_free to lifecycle tools)
    test/
  variant-vscode/      # Enhance later (after CLI works)
```

CLI bin: `packages/variant-api/src/cli.ts` (cleye entry)

## Testing convention

Every test file SHALL use Bun's test runner and live under its package `test/`
directory as `<file>.test.ts`. Each file starts with:

```typescript
import { describe, expect, it } from "bun:test";
```

## Risks / Trade-offs

**[Risk]** Drizzle/driver version churn → **Mitigation:** Pin compatible versions, test multi-dialect adapters in CI
**[Risk]** yq format drift from reference → **Mitigation:** Test suite with reference YAML samples
**[Risk]** Git worktree parsing breaks on exotic setups → **Mitigation:** Explicit `-s`/`--slug` always takes precedence
**[Trade-off]** Bun-only (no Node fallback) → Faster, simpler deps, limits audience
**[Trade-off]** No built-in migrations → Flexible, but user must wire `seed` command

## Migration Plan

1. Delete existing BuiltWith code and remove its package/API references
2. Install: `bun add drizzle-orm postgres mysql2 yaml smol-toml cleye zod@4`
3. Implement packages in order: `variant-config` → `variant-api` → `variant-mcp`
4. Port reference test cases from `variants-*.test.sh` to `bun:test`
5. CLI smoke test: `variant config`, `variant create test`, `variant list`, `variant destroy test`
6. MCP integration test: mock client calling lifecycle tools
7. Update docs (VitePress user guide replaces BuiltWith docs)

Rollback: revert PR (this is a pivot, not a feature flag)

## Open Questions

None — design decisions resolved above. Implementation details (error messages, log format) defer to TDD.
