import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { requestLine } from "./request-log.js";

export type EventKind = "startup" | "request";

export interface Events {
  record: (kind: EventKind, detail: string) => void;
  close: () => void;
}

/** The variant's database: `SQLITE_DATABASE`, which `variants.yaml` points into `.cache/variant/`. */
export const databasePath = (): string => process.env.SQLITE_DATABASE ?? "./example.sqlite";

/** Opens the database and makes the `events` table when it is absent, so no seed or migration has to run first. */
export const openEvents = (path: string = databasePath()): Events => {
  if (path !== ":memory:") {
    mkdirSync(dirname(path), { recursive: true });
  }
  const database = new Database(path);
  // A short-lived reader of the same file (`GET /api` reads `notes`) must not make a write fail.
  database.run("PRAGMA busy_timeout = 2000");
  database.run(
    "CREATE TABLE IF NOT EXISTS events (id INTEGER PRIMARY KEY, at TEXT NOT NULL, kind TEXT NOT NULL, detail TEXT NOT NULL)",
  );
  const insert = database.prepare("INSERT INTO events (at, kind, detail) VALUES (?, ?, ?)");
  return {
    record: (kind, detail) => {
      insert.run(new Date().toISOString(), kind, detail);
    },
    close: () => {
      database.close();
    },
  };
};

/** Express-style middleware: one `request` row per answered request, whatever the path, written when the response finishes. */
export const recordRequests =
  (events: Events) =>
  (
    req: { method: string; originalUrl: string },
    res: { statusCode: number; on: (event: "finish", listener: () => void) => void },
    next: () => void,
  ): void => {
    res.on("finish", () => events.record("request", requestLine(req.method, req.originalUrl, res.statusCode)));
    next();
  };
