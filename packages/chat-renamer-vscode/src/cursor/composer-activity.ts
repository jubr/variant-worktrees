import { existsSync } from "node:fs";
import {
  COMPOSER_ACTIVITY_SQL,
  composerDataActivitySql,
  composerIdsFromHeaders,
  composerRowsActive,
  RECENT_COMPOSER_SQL,
  runSqlite3,
} from "chat-renamer-api";

/** Reads composer status fields from Cursor's state database. A missing database is idle. */
export const readComposerActivity = async (dbPath: string, alsoIds: readonly string[] = []): Promise<boolean> => {
  if (!existsSync(dbPath)) {
    return false;
  }
  try {
    const headerIds = composerIdsFromHeaders(await runSqlite3(dbPath, RECENT_COMPOSER_SQL));
    // Newest headers first. The open-id list is over 100 and would otherwise fill the 20-row cap.
    const ids = [...new Set([...headerIds, ...alsoIds])];
    const pointSql = composerDataActivitySql(ids);
    const json = pointSql === undefined ? "[]" : await runSqlite3(dbPath, pointSql);
    return composerRowsActive(json);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    if (!detail.includes("no such table")) {
      return false;
    }
    try {
      return composerRowsActive(await runSqlite3(dbPath, COMPOSER_ACTIVITY_SQL));
    } catch {
      return false;
    }
  }
};
