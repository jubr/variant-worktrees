import { execFile } from "node:child_process";

export type FirstPrompt = { text: string; submittedAtMs?: number };

/** Runs one read-only query against Cursor's state.vscdb and returns sqlite3's `-json` output. */
export type SqliteRunner = (dbPath: string, sql: string) => Promise<string>;

const SAFE_ID = /^[A-Za-z0-9_-]+$/;

export const runSqlite3: SqliteRunner = (dbPath, sql) =>
  new Promise((resolve, reject) => {
    execFile(
      "sqlite3",
      ["-readonly", "-json", dbPath, sql],
      { timeout: 3000, maxBuffer: 4_000_000 },
      (error, stdout) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(stdout);
      },
    );
  });

/**
 * Combines the first human bubble header (`fullConversationHeadersOnly` entry) with that bubble's full text.
 * Falls back to the header's `grouping.textPreview` when the bubble row is not available.
 */
export const parseFirstPrompt = (headerJson: string, bubbleText: string | undefined): FirstPrompt | undefined => {
  let header: { grouping?: { textPreview?: unknown }; createdAt?: unknown };
  try {
    header = JSON.parse(headerJson) as typeof header;
  } catch {
    return undefined;
  }
  const preview = typeof header.grouping?.textPreview === "string" ? header.grouping.textPreview : "";
  const text = bubbleText && bubbleText.trim().length > 0 ? bubbleText : preview;
  if (text.trim().length === 0) {
    return undefined;
  }
  const submittedAtMs = typeof header.createdAt === "string" ? Date.parse(header.createdAt) : Number.NaN;
  return Number.isFinite(submittedAtMs) ? { text, submittedAtMs } : { text };
};

const firstValue = (output: string): string | undefined => {
  const trimmed = output.trim();
  if (trimmed.length === 0) {
    return undefined;
  }
  try {
    const rows = JSON.parse(trimmed) as Array<{ v?: unknown }>;
    const value = rows[0]?.v;
    return typeof value === "string" ? value : undefined;
  } catch {
    return undefined;
  }
};

/**
 * Queries for the first human message header, newest known layout first. Newer Cursor builds keep the headers of a chat in
 * rows `composerConvHeaders:<id>:<chunk>`; earlier builds list them in the chat record `composerData:<id>`.
 * The key range keeps SQLite on the unique key index (`;` follows `:`).
 */
const headerQueries = (sessionId: string): string[] => [
  `select j.value as v from cursorDiskKV kv, json_each(kv.value) j where kv.key >= 'composerConvHeaders:${sessionId}:' and kv.key < 'composerConvHeaders:${sessionId};' and json_extract(j.value, '$.type') = 1 order by kv.key limit 1`,
  `select j.value as v from cursorDiskKV kv, json_each(json_extract(kv.value, '$.fullConversationHeadersOnly')) j where kv.key = 'composerData:${sessionId}' and json_extract(j.value, '$.type') = 1 limit 1`,
];

/**
 * Reads a chat's first human prompt from Cursor's on-disk store (cursorDiskKV in state.vscdb), which the
 * extension API does not expose otherwise. Private, version-fragile layout (Cursor 3.23.x). Resolves undefined
 * when anything is missing or unreadable, so callers can fall back.
 */
export const readFirstPrompt = async ({
  dbPath,
  sessionId,
  run = runSqlite3,
}: {
  dbPath: string;
  sessionId: string;
  run?: SqliteRunner;
}): Promise<FirstPrompt | undefined> => {
  if (!SAFE_ID.test(sessionId)) {
    return undefined;
  }
  try {
    // AIDEV-NOTE: Newer layout first, then the older one. Each method fails on its own: a method that worked in an
    // earlier version is never dropped, and a fault in a newer one never ends the read.
    let headerJson: string | undefined;
    for (const sql of headerQueries(sessionId)) {
      try {
        headerJson = firstValue(await run(dbPath, sql));
      } catch {
        headerJson = undefined;
      }
      if (headerJson) {
        break;
      }
    }
    if (!headerJson) {
      return undefined;
    }
    const bubbleId = (JSON.parse(headerJson) as { bubbleId?: unknown }).bubbleId;
    const bubbleText =
      typeof bubbleId === "string" && SAFE_ID.test(bubbleId)
        ? firstValue(
            await run(
              dbPath,
              `select json_extract(value, '$.text') as v from cursorDiskKV where key = 'bubbleId:${sessionId}:${bubbleId}'`,
            ),
          )
        : undefined;
    return parseFirstPrompt(headerJson, bubbleText);
  } catch {
    return undefined;
  }
};

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** Polls the on-disk store: Cursor writes the first bubble shortly after the title event, not necessarily before it. */
export const readFirstPromptWithRetry = async (
  read: () => Promise<FirstPrompt | undefined>,
  attempts = 6,
  delayMs = 500,
): Promise<FirstPrompt | undefined> => {
  for (let attempt = 0; attempt < attempts; attempt++) {
    const found = await read();
    if (found) {
      return found;
    }
    if (attempt < attempts - 1) {
      await sleep(delayMs);
    }
  }
  return undefined;
};
