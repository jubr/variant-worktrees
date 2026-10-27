import { describe, expect, it } from "bun:test";

import {
  activationPatternsSchema,
  ChatRenamerConfigSchema,
  hookScopeSchema,
  promptLineLimitSchema,
  renameExistingDaysSchema,
  triggerSchema,
  worktreePrefixesSchema,
} from "../src/schema";

describe("worktreePrefixesSchema", () => {
  it("accepts prefixes with their connector", () => {
    expect(worktreePrefixesSchema.safeParse(["_work-"]).success).toBe(true);
    expect(worktreePrefixesSchema.safeParse([]).success).toBe(true);
  });

  it("rejects empty and separator-bearing entries", () => {
    expect(worktreePrefixesSchema.safeParse([""]).success).toBe(false);
    expect(worktreePrefixesSchema.safeParse(["a/b"]).success).toBe(false);
    expect(worktreePrefixesSchema.safeParse(["a\\b"]).success).toBe(false);
  });

  it("explains a separator", () => {
    const result = worktreePrefixesSchema.safeParse(["a/b"]);
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

describe("promptLineLimitSchema", () => {
  it("accepts integers of at least 1", () => {
    expect(promptLineLimitSchema.safeParse(1).success).toBe(true);
    expect(promptLineLimitSchema.safeParse(10).success).toBe(true);
  });

  it("rejects zero, fractions and non-numbers", () => {
    expect(promptLineLimitSchema.safeParse(0).success).toBe(false);
    expect(promptLineLimitSchema.safeParse(2.5).success).toBe(false);
    expect(promptLineLimitSchema.safeParse("10").success).toBe(false);
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

describe("triggerSchema and hookScopeSchema", () => {
  it("accept the listed values and reject others", () => {
    expect(triggerSchema.safeParse("hook").success).toBe(true);
    expect(triggerSchema.safeParse("titleEvent").success).toBe(true);
    expect(triggerSchema.safeParse("poll").success).toBe(false);
    expect(hookScopeSchema.safeParse("user").success).toBe(true);
    expect(hookScopeSchema.safeParse("global").success).toBe(false);
  });
});

describe("ChatRenamerConfigSchema", () => {
  it("accepts an empty section and a full one", () => {
    expect(ChatRenamerConfigSchema.safeParse({}).success).toBe(true);
    expect(
      ChatRenamerConfigSchema.safeParse({
        trigger: "hook",
        hookScope: "user",
        activationPatterns: ["/x/"],
        worktreePrefixes: ["_v-"],
        renameExistingDays: 30,
        titleEventPromptLines: 20,
      }).success,
    ).toBe(true);
  });

  it("rejects unknown keys and invalid values", () => {
    expect(ChatRenamerConfigSchema.safeParse({ colour: "red" }).success).toBe(false);
    expect(ChatRenamerConfigSchema.safeParse({ renameExistingDays: -1 }).success).toBe(false);
    expect(ChatRenamerConfigSchema.safeParse({ titleEventPromptLines: 0 }).success).toBe(false);
  });
});
