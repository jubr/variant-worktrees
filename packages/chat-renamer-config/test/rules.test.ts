import { describe, expect, it } from "bun:test";

import { isHookScope, isRenameExistingDays, isTrigger, isWorktreePrefix } from "../src/index";

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
  it("accepts non-empty strings without separators, connector included", () => {
    expect(["_v-", "_work-", "ws_"].map(isWorktreePrefix)).toEqual([true, true, true]);
    expect(["", "a/b-", "a\\b", 3].map(isWorktreePrefix)).toEqual([false, false, false, false]);
  });
});

describe("isTrigger and isHookScope", () => {
  it("accept only the listed values", () => {
    expect(["titleEvent", "hook"].map(isTrigger)).toEqual([true, true]);
    expect(["poll", "", 1].map(isTrigger)).toEqual([false, false, false]);
    expect(["workspace", "user"].map(isHookScope)).toEqual([true, true]);
    expect(["global", undefined].map(isHookScope)).toEqual([false, false]);
  });
});
