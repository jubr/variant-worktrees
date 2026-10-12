import { describe, expect, it } from "bun:test";

import { activationPatternsSchema, renameExistingDaysSchema, worktreePrefixSchema } from "../src/schema";

describe("worktreePrefixSchema", () => {
  it("accepts a non-empty prefix without separators", () => {
    expect(worktreePrefixSchema.safeParse("_work").success).toBe(true);
    expect(worktreePrefixSchema.safeParse("_v").success).toBe(true);
  });

  it("rejects empty and separator-bearing prefixes", () => {
    expect(worktreePrefixSchema.safeParse("").success).toBe(false);
    expect(worktreePrefixSchema.safeParse("a/b").success).toBe(false);
    expect(worktreePrefixSchema.safeParse("a\\b").success).toBe(false);
  });

  it("explains a separator", () => {
    const result = worktreePrefixSchema.safeParse("a/b");
    expect(result.success ? "" : result.error.issues[0]?.message).toContain("path separator");
  });
});

describe("renameExistingDaysSchema", () => {
  it("accepts zero and positive integers", () => {
    expect(renameExistingDaysSchema.safeParse(0).success).toBe(true);
    expect(renameExistingDaysSchema.safeParse(7).success).toBe(true);
  });

  it("rejects negatives, fractions and non-numbers", () => {
    expect(renameExistingDaysSchema.safeParse(-1).success).toBe(false);
    expect(renameExistingDaysSchema.safeParse(1.5).success).toBe(false);
    expect(renameExistingDaysSchema.safeParse("7").success).toBe(false);
  });
});

describe("activationPatternsSchema", () => {
  it("accepts string arrays, including empty", () => {
    expect(activationPatternsSchema.safeParse([]).success).toBe(true);
    expect(activationPatternsSchema.safeParse(["/x/"]).success).toBe(true);
  });

  it("rejects other shapes", () => {
    expect(activationPatternsSchema.safeParse("x").success).toBe(false);
    expect(activationPatternsSchema.safeParse([1]).success).toBe(false);
  });
});
