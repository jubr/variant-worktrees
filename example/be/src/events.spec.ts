import { describe, expect, it } from "bun:test";
import { Database } from "bun:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openEvents, recordRequests } from "./events.js";

const withDatabaseFile = (run: (path: string) => void): void => {
  const directory = mkdtempSync(join(tmpdir(), "example-be-events-"));
  try {
    run(join(directory, "nested", "events.sqlite"));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
};

const rowsOf = (path: string): { kind: string; detail: string; at: string }[] => {
  const database = new Database(path, { readonly: true });
  try {
    return database.query("SELECT kind, detail, at FROM events ORDER BY id").all() as {
      kind: string;
      detail: string;
      at: string;
    }[];
  } finally {
    database.close();
  }
};

describe("events", () => {
  it("creates the file, its directory and the events table, and records a startup row", () =>
    withDatabaseFile((path) => {
      const events = openEvents(path);
      events.record("startup", "port 3000");
      events.close();

      const [row, ...rest] = rowsOf(path);
      expect(rest).toEqual([]);
      expect(row).toMatchObject({ kind: "startup", detail: "port 3000" });
      expect(Number.isNaN(Date.parse(row?.at ?? ""))).toBe(false);
    }));

  it("keeps the rows of an earlier run and the notes table of the seed", () =>
    withDatabaseFile((path) => {
      const first = openEvents(path);
      first.record("startup", "first");
      first.close();
      const seeded = new Database(path);
      seeded.run("CREATE TABLE notes (id INTEGER PRIMARY KEY, text TEXT NOT NULL)");
      seeded.run("INSERT INTO notes (text) VALUES ('hello from the seed')");
      seeded.close();

      const second = openEvents(path);
      second.record("startup", "second");
      second.close();

      expect(rowsOf(path).map((row) => row.detail)).toEqual(["first", "second"]);
      const check = new Database(path, { readonly: true });
      expect(check.query("SELECT text FROM notes").all()).toEqual([{ text: "hello from the seed" }]);
      check.close();
    }));
});

describe("recordRequests", () => {
  it("records a request row with method, URL and status when the response finishes", () =>
    withDatabaseFile((path) => {
      const events = openEvents(path);
      const middleware = recordRequests(events);
      const respond = (method: string, originalUrl: string, statusCode: number): void => {
        let finish = (): void => {};
        let passed = false;
        middleware(
          { method, originalUrl },
          {
            statusCode,
            on: (_event, listener) => {
              finish = listener;
            },
          },
          () => {
            passed = true;
          },
        );
        expect(passed).toBe(true);
        finish();
      };

      respond("GET", "/api", 200);
      respond("GET", "/missing", 404);
      events.close();

      expect(rowsOf(path).map(({ kind, detail }) => ({ kind, detail }))).toEqual([
        { kind: "request", detail: "GET /api 200" },
        { kind: "request", detail: "GET /missing 404" },
      ]);
    }));

  it("records nothing before the response finishes", () =>
    withDatabaseFile((path) => {
      const events = openEvents(path);
      recordRequests(events)(
        { method: "GET", originalUrl: "/api" },
        { statusCode: 200, on: () => {} },
        () => {},
      );
      events.close();

      expect(rowsOf(path)).toEqual([]);
    }));
});
