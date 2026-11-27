import { existsSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

/**
 * Specification: openspec/specs/variant-config/core/spec.md (SQLite files of the former location are kept)
 *
 * Earlier versions stored the SQLite file of a variant in `<directory of variants.yaml>/.cache/variants/<slug>.db`,
 * shared by every worktree of the main checkout.
 */

const FORMER_DIRECTORY = join(".cache", "variants");

/**
 * `<absolute configDir>/.cache/variants/${slug}.db` when that directory holds a `.db` file, so those files stay the
 * databases of their variants. Nothing when it holds none, or when `database` is already set. Reads the file system.
 */
export const findFormerSqliteDatabase = (configDir: string, database?: string): string | undefined => {
  if (database !== undefined) {
    return undefined;
  }
  const directory = join(resolve(configDir), FORMER_DIRECTORY);
  try {
    if (!existsSync(directory) || !readdirSync(directory).some((name) => name.endsWith(".db"))) {
      return undefined;
    }
  } catch {
    return undefined;
  }
  return join(directory, "${slug}.db");
};

/** The migration notice for the former location: where the value comes from and which file it belongs in. */
export const formerDatabaseNotice = (file: string, database: string): string =>
  `${file}: db.database is now ${database} because ${dirname(database)} holds .db files of an earlier version`;
