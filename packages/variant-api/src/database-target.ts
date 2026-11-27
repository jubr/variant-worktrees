import { hasSchemaPlaceholder } from "./db/mysql-names.js";
import type { OperationContext } from "./operations/types.js";

/**
 * The database target of `slug`: the SQLite file for SQLite (also for `main`), otherwise the schema, where `main` uses
 * the configured one (`public` by default, `main` for a MySQL database per variant) and every other slug its own
 * `v_<slug>`.
 * Specification: openspec/specs/variant-api/core/spec.md (One SQLite target for every slug)
 */
export const databaseTarget = (context: OperationContext, slug: string): string => {
  if (slug !== "main" || context.adapter.type === "sqlite") {
    return context.adapter.target(slug);
  }
  // AIDEV-NOTE: a MySQL database per variant (`${schema}` in db.database) names main's database `<prefix>main`
  const fallback =
    context.config.db.type === "mysql" && hasSchemaPlaceholder(context.config.db.database) ? "main" : "public";
  return context.config.db.schema ?? fallback;
};
