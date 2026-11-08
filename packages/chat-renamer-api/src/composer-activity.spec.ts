import { describe, expect, it } from "bun:test";

import { composerIsActive, composerRowsActive } from "./composer-activity";

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
});

describe("composerRowsActive", () => {
  it("is active when any row is generating", () => {
    const json = JSON.stringify([
      { status: "completed", continuation: 0, bubbles: 0 },
      { status: "generating", continuation: 0, bubbles: 1 },
    ]);

    expect(composerRowsActive(json)).toBe(true);
  });

  it("is idle for empty output", () => {
    expect(composerRowsActive("")).toBe(false);
    expect(composerRowsActive("[]")).toBe(false);
  });
});
