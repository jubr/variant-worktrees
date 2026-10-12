import { describe, expect, it } from "bun:test";

import { isRenameExistingDays, isWorktreePrefix } from "../src/index";

describe("isRenameExistingDays", () => {
  it("accepts zero and positive integers only", () => {
    expect([0, 7, 365].map(isRenameExistingDays)).toEqual([true, true, true]);
    expect([-1, 1.5, Number.NaN, "7", true, undefined].map(isRenameExistingDays)).toEqual([
      false,
      false,
      false,
      false,
      false,
      false,
    ]);
  });
});

describe("isWorktreePrefix", () => {
  it("accepts non-empty strings without separators", () => {
    expect(["_v", "_work"].map(isWorktreePrefix)).toEqual([true, true]);
    expect(["", "a/b", "a\\b", 3].map(isWorktreePrefix)).toEqual([false, false, false, false]);
  });
});
