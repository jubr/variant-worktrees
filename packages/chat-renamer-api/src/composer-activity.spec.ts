import { describe, expect, it } from "bun:test";

import {
  composerDataActivitySql,
  composerIdsFromHeaders,
  composerIsActive,
  composerRowsActive,
  RECENT_COMPOSER_SQL,
} from "./composer-activity";

describe("composerIsActive", () => {
  it("treats a generating composer as active", () => {
    expect(composerIsActive({ status: "generating", generatingBubbleIds: ["b1"] })).toBe(true);
  });

  it("treats tool work that still holds generating bubbles as active", () => {
    expect(composerIsActive({ status: "completed", generatingBubbleIds: ["tool-1"] })).toBe(true);
    expect(composerIsActive({ status: "none", isContinuationInProgress: true, generatingBubbleIds: [] })).toBe(true);
  });

  it("treats an idle or selected chat as inactive", () => {
    expect(composerIsActive({ status: "none", generatingBubbleIds: [] })).toBe(false);
    expect(composerIsActive({ status: "completed", generatingBubbleIds: [] })).toBe(false);
  });

  it("treats an aborted turn with leftover bubble ids as inactive", () => {
    expect(composerIsActive({ status: "aborted", generatingBubbleIds: ["b1"] })).toBe(false);
  });

  it("treats an aborted row that still has a generation uuid as active", () => {
    expect(composerIsActive({ status: "aborted", generatingBubbleIds: [], hasChatGeneration: true })).toBe(true);
    expect(composerIsActive({ status: "aborted", generatingBubbleIds: [], hasChatGeneration: false })).toBe(false);
  });
});

describe("composerRowsActive", () => {
  it("is active when any row is generating", () => {
    const json = JSON.stringify([
      { status: "completed", continuation: 0, bubbles: 0 },
      { status: "generating", continuation: 0, bubbles: 1 },
    ]);

    expect(composerRowsActive(json)).toBe(true);
  });

  it("is active when a saved row is aborted but still has a generation uuid", () => {
    const live = JSON.stringify([{ status: "aborted", continuation: 0, bubbles: 0, hasChatGen: 1 }]);
    const done = JSON.stringify([{ status: "completed", continuation: 0, bubbles: 0, hasChatGen: 0 }]);

    expect(composerRowsActive(live)).toBe(true);
    expect(composerRowsActive(done)).toBe(false);
  });

  it("is idle for empty output", () => {
    expect(composerRowsActive("")).toBe(false);
    expect(composerRowsActive("[]")).toBe(false);
  });
});

describe("recent composer lookup", () => {
  it("reads status from the newest composerData rows", () => {
    const ids = composerIdsFromHeaders(
      JSON.stringify([{ composerId: "abc-1" }, { composerId: "bad id" }, { composerId: "ok_2" }]),
    );

    expect(RECENT_COMPOSER_SQL).toContain("from composerHeaders");
    expect(RECENT_COMPOSER_SQL).not.toContain("cursorDiskKV");
    expect(ids).toEqual(["abc-1", "ok_2"]);
    expect(composerDataActivitySql(ids)).toBe(
      "select json_extract(value, '$.status') as status, json_extract(value, '$.isContinuationInProgress') as continuation, json_array_length(json_extract(value, '$.generatingBubbleIds')) as bubbles, json_extract(value, '$.chatGenerationUUID') is not null as hasChatGen, substr(key, 14) as id from cursorDiskKV where key in ('composerData:abc-1','composerData:ok_2')",
    );
    expect(composerDataActivitySql([])).toBeUndefined();
    expect(composerDataActivitySql(["quote'"])).toBeUndefined();
  });
});
