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
  };
  if (data.status === "generating" || data.isContinuationInProgress === true) {
    return true;
  }
  return data.status !== "aborted" && Array.isArray(data.generatingBubbleIds) && data.generatingBubbleIds.length > 0;
};

/** Read-only query of the status fields. Does not load prompt text. */
export const COMPOSER_ACTIVITY_SQL =
  "select json_extract(value, '$.status') as status, json_extract(value, '$.isContinuationInProgress') as continuation, json_array_length(json_extract(value, '$.generatingBubbleIds')) as bubbles from cursorDiskKV where key like 'composerData:%'";

type ActivityRow = { status?: unknown; continuation?: unknown; bubbles?: unknown };

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
    });
  });
};
