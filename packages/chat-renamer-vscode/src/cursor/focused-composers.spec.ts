import { Database } from "bun:sqlite";
import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { readFocusedComposersActive, readLastFocusedComposerIds } from "./focused-composers";

const dirs: string[] = [];

afterEach(() => {
  for (const dir of dirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

const tempDir = (): string => {
  const dir = mkdtempSync(join(tmpdir(), "awake-focused-"));
  dirs.push(dir);
  return dir;
};

const workspaceDb = (value: string | undefined): string => {
  const path = join(tempDir(), "state.vscdb");
  const db = new Database(path);
  db.run("create table ItemTable (key text primary key, value text)");
  if (value !== undefined) {
    db.run("insert into ItemTable (key, value) values (?, ?)", ["composer.composerData", value]);
  }
  db.close();
  return path;
};

const globalDb = (rows: { id: string; body: unknown }[]): string => {
  const path = join(tempDir(), "state.vscdb");
  const db = new Database(path);
  db.run("create table cursorDiskKV (key text primary key, value text)");
  for (const row of rows) {
    db.run("insert into cursorDiskKV (key, value) values (?, ?)", [`composerData:${row.id}`, JSON.stringify(row.body)]);
  }
  db.close();
  return path;
};

const safeIds = (count: number, start = 1): string[] =>
  Array.from({ length: count }, (_, index) => `id-${String(start + index).padStart(2, "0")}`);

describe("readLastFocusedComposerIds", () => {
  it("returns the first 20 safe last-focused ids in order", async () => {
    const path = workspaceDb(JSON.stringify({ lastFocusedComposerIds: ["id-01", "bad id", ...safeIds(20, 2)] }));

    expect(await readLastFocusedComposerIds(path)).toEqual(safeIds(20));
  });

  it("returns an empty list when the workspace database cannot be read", async () => {
    const missing = join(tempDir(), "state.vscdb");
    const noKey = workspaceDb(undefined);
    const invalid = workspaceDb("{not json");

    expect(await readLastFocusedComposerIds(missing)).toEqual([]);
    expect(await readLastFocusedComposerIds(noKey)).toEqual([]);
    expect(await readLastFocusedComposerIds(invalid)).toEqual([]);
  });
});

describe("readFocusedComposersActive", () => {
  it("counts an unfinished focused row that pane order would miss, and ignores a generating row outside the list", async () => {
    const focused = workspaceDb(JSON.stringify({ lastFocusedComposerIds: ["tool-chat"] }));
    const global = globalDb([
      { id: "tool-chat", body: { status: "aborted", unfinishedRunAt: 1_762_000_000_000, generatingBubbleIds: [] } },
      { id: "pane-chat", body: { status: "generating", generatingBubbleIds: [] } },
    ]);

    expect(await readFocusedComposersActive(global, focused)).toBe(true);

    const idleFocus = workspaceDb(JSON.stringify({ lastFocusedComposerIds: ["idle-chat"] }));
    const outside = globalDb([
      { id: "idle-chat", body: { status: "aborted", generatingBubbleIds: [] } },
      { id: "pane-chat", body: { status: "generating", generatingBubbleIds: [] } },
    ]);

    expect(await readFocusedComposersActive(outside, idleFocus)).toBe(false);
  });
});
