import { existsSync } from "node:fs";
import { composerDataActivitySql, composerRowsActive, runSqlite3 } from "chat-renamer-api";

/**
 * Point-reads composer status for the ids this host has open.
 * A missing database, a failed read, or an empty id list is idle.
 *
 * Specification: openspec/specs/chat-renamer/awake/spec.md
 */
export const readComposerActivity = async (dbPath: string, openIds: readonly string[] = []): Promise<boolean> => {
  if (!existsSync(dbPath)) {
    return false;
  }
  const pointSql = composerDataActivitySql(openIds);
  if (pointSql === undefined) {
    return false;
  }
  try {
    return composerRowsActive(await runSqlite3(dbPath, pointSql));
  } catch {
    return false;
  }
};
