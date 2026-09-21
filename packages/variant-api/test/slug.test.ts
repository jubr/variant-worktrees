import { describe, expect, it } from "bun:test";
import { execFileSync } from "node:child_process";
import { resolveSlug, sanitizeSlug } from "../src/slug.js";

describe("variant slug resolution", () => {
  it("normalizes branch-like names", () => {
    expect(sanitizeSlug("feat/Add Auth")).toBe("add-auth");
    expect(sanitizeSlug("refs/heads/fix/BUG_42")).toBe("bug-42");
  });

  it("uses explicit slug before git detection", () => {
    expect(resolveSlug("Preview One", "/not-a-git-repository")).toBe("preview-one");
  });

  it("derives slug from the current worktree", () => {
    const branch = execFileSync("git", ["branch", "--show-current"], {
      cwd: process.cwd(),
      encoding: "utf8",
    }).trim();
    const expected = branch === "main" ? "main" : sanitizeSlug(branch.replace(/^(feat|fix)\//, ""));
    expect(resolveSlug(undefined, process.cwd())).toBe(expected);
  });
});
