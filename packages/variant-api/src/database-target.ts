import type { OperationContext } from "./operations/types.js";

/**
 * The database target of `slug`: the SQLite file for SQLite (also for `main`), otherwise the schema, where `main` uses
 * the configured one (`public` by default) and every other slug its own `v_<slug>`.
 * Specification: openspec/specs/variant-api/core/spec.md (One SQLite target for every slug)
 */
export const databaseTarget = (context: OperationContext, slug: string): string =>
  slug === "main" && context.adapter.dialect !== "sqlite"
    ? (context.config.db.schema ?? "public")
    : context.adapter.target(slug);
