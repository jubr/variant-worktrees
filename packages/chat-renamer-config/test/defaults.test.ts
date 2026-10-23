import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";

import * as defaults from "../src/index";

describe("defaults", () => {
  it("exports the six renamer defaults", () => {
    expect(defaults.DEFAULT_TRIGGER).toBe("titleEvent");
    expect(defaults.DEFAULT_HOOK_SCOPE).toBe("workspace");
    expect(defaults.DEFAULT_ACTIVATION_PATTERNS).toEqual([
      "/[a-z]+-spec-[a-z]+\\s+@\\S+/[A-Za-z0-9_]+-([A-Za-z0-9_-]+)/?(?=\\s|$)",
      "/[a-z]+-spec-[a-z]+\\s+@_work-([A-Za-z0-9_-]+)/?(?=\\s|$)",
      "/[a-z]+-spec-[a-z]+\\s+([A-Za-z0-9_-]+)",
    ]);
    expect(defaults.DEFAULT_WORKTREE_PREFIXES).toEqual([]);
    expect(defaults.DEFAULT_RENAME_EXISTING_DAYS).toBe(7);
    expect(defaults.DEFAULT_TITLE_EVENT_PROMPT_LINES).toBe(10);
  });

  it("lists the allowed trigger and hook scope values", () => {
    expect(defaults.TRIGGERS).toEqual(["titleEvent", "hook"]);
    expect(defaults.HOOK_SCOPES).toEqual(["workspace", "user"]);
  });

  it("does not own the variant prefix", () => {
    expect(Object.keys(defaults)).not.toContain("DEFAULT_WORKTREE_PREFIX");
    expect(Object.keys(defaults)).not.toContain("DEFAULT_PREFIX");
  });

  it("keeps the main entry free of Zod", () => {
    const sources = ["../src/index.ts", "../src/defaults.ts", "../src/rules.ts"].map((file) =>
      readFileSync(new URL(file, import.meta.url), "utf8"),
    );
    for (const source of sources) {
      expect(source).not.toContain("zod");
    }
  });
});
