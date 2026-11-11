/**
 * A chat is in a turn when Cursor says so. Matches the editor's own check: generating, a continuation,
 * or generating bubbles that were not aborted.
 *
 * AIDEV-NOTE: aborted with leftover bubble ids is idle. Tool work keeps `generating` or those ids.
 */
export const composerIsActive = (record: unknown): boolean => {
  if (record === null || typeof record !== "object") {
    return false;
  }
  const data = record as {
    status?: unknown;
    isContinuationInProgress?: unknown;
    generatingBubbleIds?: unknown;
    hasChatGeneration?: unknown;
    unfinishedRunAt?: unknown;
  };
  // AIDEV-NOTE: disk persist stores a live turn as aborted while chatGenerationUUID remains. Completion clears it.
  // AIDEV-NOTE: an aborted row keeps chatGenerationUUID after the turn ends. That leftover is idle.
  // AIDEV-NOTE: a live tool run stays status aborted and sets unfinishedRunAt. The uuid alone does not.
  if (typeof data.unfinishedRunAt === "number" && data.unfinishedRunAt > 0) {
    return true;
  }
  if (data.status === "generating" || data.isContinuationInProgress === true) {
    return true;
  }
  if (data.hasChatGeneration === true && data.status !== "aborted") {
    return true;
  }
  return data.status !== "aborted" && Array.isArray(data.generatingBubbleIds) && data.generatingBubbleIds.length > 0;
};

/** How many newest chats to open. A full `composerData:%` scan of a large state db exceeds the sqlite timeout. */
export const RECENT_COMPOSER_LIMIT = 20;

/**
 * Ids of the newest header rows. The header is small. Each id is then a point read of `composerData:<id>`.
 *
 * AIDEV-NOTE: `composerHeaders` only picks rows. Activity is still the composerData status marker.
 */
export const RECENT_COMPOSER_SQL = `select composerId, lastUpdatedAt from composerHeaders where lastUpdatedAt is not null order by lastUpdatedAt desc limit ${RECENT_COMPOSER_LIMIT}`;

const SAFE_COMPOSER_ID = /^[A-Za-z0-9_-]+$/;

/** Safe composer ids from `composerHeaders` json. Anything else is dropped so it cannot enter SQL. */
export const composerIdsFromHeaders = (json: string): string[] => {
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
  if (!Array.isArray(rows)) {
    return [];
  }
  const ids: string[] = [];
  for (const row of rows) {
    if (ids.length >= RECENT_COMPOSER_LIMIT) {
      break;
    }
    const id = row !== null && typeof row === "object" ? (row as { composerId?: unknown }).composerId : undefined;
    if (typeof id === "string" && SAFE_COMPOSER_ID.test(id)) {
      ids.push(id);
    }
  }
  return ids;
};

/** Point-read of those composers. Undefined when there is nothing safe to open. */
export const composerDataActivitySql = (ids: readonly string[]): string | undefined => {
  const keys = ids.filter((id) => SAFE_COMPOSER_ID.test(id)).slice(0, RECENT_COMPOSER_LIMIT);
  if (keys.length === 0) {
    return undefined;
  }
  const list = keys.map((id) => `'composerData:${id}'`).join(",");
  return `${COMPOSER_ACTIVITY_SQL.replace(" from cursorDiskKV where key like 'composerData:%'", ", substr(key, 14) as id from cursorDiskKV")} where key in (${list})`;
};

/** Read-only query of the status fields. Does not load prompt text. */
export const COMPOSER_ACTIVITY_SQL =
  "select json_extract(value, '$.status') as status, json_extract(value, '$.isContinuationInProgress') as continuation, json_array_length(json_extract(value, '$.generatingBubbleIds')) as bubbles, json_extract(value, '$.chatGenerationUUID') is not null as hasChatGen, json_extract(value, '$.unfinishedRunAt') as unfinished from cursorDiskKV where key like 'composerData:%'";

type ActivityRow = {
  status?: unknown;
  continuation?: unknown;
  bubbles?: unknown;
  hasChatGen?: unknown;
  unfinished?: unknown;
};

/** `sqlite3 -json` output of {@link COMPOSER_ACTIVITY_SQL}. Empty or unreadable output is idle. */
export const composerRowsActive = (json: string): boolean => {
  const trimmed = json.trim();
  if (trimmed.length === 0) {
    return false;
  }
  let rows: unknown;
  try {
    rows = JSON.parse(trimmed);
  } catch {
    return false;
  }
  if (!Array.isArray(rows)) {
    return false;
  }
  return rows.some((row) => {
    if (row === null || typeof row !== "object") {
      return false;
    }
    const record = row as ActivityRow;
    const bubbles =
      typeof record.bubbles === "number" && record.bubbles > 0 ? Array.from({ length: record.bubbles }) : [];
    return composerIsActive({
      status: record.status,
      isContinuationInProgress: record.continuation === true || record.continuation === 1,
      generatingBubbleIds: bubbles,
      hasChatGeneration: record.hasChatGen === true || record.hasChatGen === 1,
      unfinishedRunAt: typeof record.unfinished === "number" ? record.unfinished : undefined,
    });
  });
};
