import { RECENT_COMPOSER_LIMIT, runSqlite3 } from "chat-renamer-api";

import { readComposerActivity } from "./composer-activity";

/**
 * Last-focused composer ids from this workspace's state database, then a point-read of those rows.
 *
 * Specification: openspec/specs/chat-renamer/awake/spec.md
 */
const SAFE_COMPOSER_ID = /^[A-Za-z0-9_-]+$/;

const FOCUSED_IDS_SQL =
  "select json_extract(value, '$.lastFocusedComposerIds') as ids from ItemTable where key = 'composer.composerData'";

const idsFromCell = (raw: unknown): string[] => {
  let list: unknown = raw;
  if (typeof raw === "string") {
    try {
      list = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(list)) {
    return [];
  }
  const ids: string[] = [];
  for (const id of list) {
    if (ids.length >= RECENT_COMPOSER_LIMIT) {
      break;
    }
    if (typeof id === "string" && SAFE_COMPOSER_ID.test(id)) {
      ids.push(id);
    }
  }
  return ids;
};

const parseFocusedIds = (json: string): string[] => {
  const trimmed = json.trim();
  if (trimmed.length === 0) {
    return [];
  }
  let rows: unknown;
  try {
    rows = JSON.parse(trimmed);
  } catch {
    return [];
  }
  if (!Array.isArray(rows) || rows.length === 0) {
    return [];
  }
  const cell = rows[0];
  if (cell === null || typeof cell !== "object") {
    return [];
  }
  return idsFromCell((cell as { ids?: unknown }).ids);
};

/** First 20 safe ids in `composer.composerData.lastFocusedComposerIds`. Unreadable input is empty. */
export const readLastFocusedComposerIds = async (workspaceDbPath: string): Promise<string[]> => {
  try {
    return parseFocusedIds(await runSqlite3(workspaceDbPath, FOCUSED_IDS_SQL));
  } catch {
    return [];
  }
};

/** Active when one of those ids is in a turn. A generating row outside the list does not count. */
export const readFocusedComposersActive = async (globalDbPath: string, workspaceDbPath: string): Promise<boolean> => {
  const ids = await readLastFocusedComposerIds(workspaceDbPath);
  return readComposerActivity(globalDbPath, ids);
};
