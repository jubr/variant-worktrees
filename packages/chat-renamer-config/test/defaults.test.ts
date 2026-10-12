import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";

import { DEFAULT_ACTIVATION_PATTERNS, DEFAULT_RENAME_EXISTING_DAYS, DEFAULT_WORKTREE_PREFIX } from "../src/index";

describe("defaults", () => {
  it("exports the three renamer defaults", () => {
    expect(DEFAULT_WORKTREE_PREFIX).toBe("_v");
    expect(DEFAULT_RENAME_EXISTING_DAYS).toBe(7);
    expect(DEFAULT_ACTIVATION_PATTERNS).toEqual(["/[a-z]+-spec-[a-z]+\\s+([A-Za-z0-9_-]+)"]);
  });

  it("keeps the main entry free of Zod", () => {
    const sources = ["../src/index.ts", "../src/defaults.ts"].map((file) =>
      readFileSync(new URL(file, import.meta.url), "utf8"),
    );
    for (const source of sources) {
      expect(source).not.toContain("zod");
    }
  });
});
