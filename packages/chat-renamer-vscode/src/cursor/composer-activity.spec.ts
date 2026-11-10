import { Database } from "bun:sqlite";
import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { readComposerActivity } from "./composer-activity";

const dirs: string[] = [];

afterEach(() => {
  for (const dir of dirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

const composerValue = (status: string): string => JSON.stringify({ status, generatingBubbleIds: [] });

/** Real sqlite file. `headers: false` omits `composerHeaders`, the older store shape. */
const stateDb = (rows: { id: string; status: string }[], headers = true): string => {
  const dir = mkdtempSync(join(tmpdir(), "awake-composer-"));
  dirs.push(dir);
  const path = join(dir, "state.vscdb");
  const db = new Database(path);
  db.run("create table cursorDiskKV (key text primary key, value text)");
  if (headers) {
    db.run("create table composerHeaders (composerId text, lastUpdatedAt integer)");
  }
  rows.forEach((row, index) => {
    db.run("insert into cursorDiskKV (key, value) values (?, ?)", [
      `composerData:${row.id}`,
      composerValue(row.status),
    ]);
    if (headers) {
      db.run("insert into composerHeaders (composerId, lastUpdatedAt) values (?, ?)", [row.id, 1_000 - index]);
    }
  });
  db.close();
  return path;
};

describe("readComposerActivity", () => {
  it("treats a generating composer that is only in the newest headers as idle", async () => {
    const dbPath = stateDb([
      { id: "foreign-chat", status: "generating" },
      { id: "open-chat", status: "aborted" },
    ]);

    expect(await readComposerActivity(dbPath, ["open-chat"])).toBe(false);
  });

  it("treats a generating composer in the open ids as active", async () => {
    const dbPath = stateDb([
      { id: "foreign-chat", status: "aborted" },
      { id: "open-chat", status: "generating" },
    ]);

    expect(await readComposerActivity(dbPath, ["open-chat"])).toBe(true);
  });

  it("ignores a generating row when composerHeaders is missing and the id is not open", async () => {
    const dbPath = stateDb([{ id: "foreign-chat", status: "generating" }], false);

    expect(await readComposerActivity(dbPath, ["open-chat"])).toBe(false);
  });

  it("reads an open generating composer when composerHeaders is missing", async () => {
    const dbPath = stateDb([{ id: "open-chat", status: "generating" }], false);

    expect(await readComposerActivity(dbPath, ["open-chat"])).toBe(true);
  });

  it("treats a missing database as idle", async () => {
    expect(await readComposerActivity(join(tmpdir(), "awake-composer-missing", "state.vscdb"), ["open-chat"])).toBe(
      false,
    );
  });
});
