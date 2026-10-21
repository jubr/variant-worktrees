import { describe, expect, it } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveSlug, sanitizeSlug } from "../src/slug.js";

describe("variant slug resolution", () => {
  it("normalizes branch-like names", () => {
    expect(sanitizeSlug("feat/Add Auth")).toBe("add-auth");
    expect(sanitizeSlug("refs/heads/fix/BUG_42")).toBe("bug-42");
  });

  it("uses explicit slug before git detection", () => {
    expect(resolveSlug("Preview One", "/not-a-git-repository")).toBe("preview-one");
  });

  it("derives the slug from a linked worktree's branch and uses main for the primary checkout", () => {
    // AIDEV-NOTE: hermetic repo; the checkout running the tests may be detached (CI pull_request merge ref).
    const directory = realpathSync(mkdtempSync(join(tmpdir(), "variant-slug-")));
    try {
      const primary = join(directory, "primary");
      const linked = join(directory, "linked");
      const git = (...args: string[]) =>
        execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.com", ...args], { cwd: primary });
      mkdirSync(primary);
      git("init", "-q", "-b", "main");
      git("commit", "-q", "--allow-empty", "-m", "init");
      git("worktree", "add", "-q", "-b", "feat/derive-me", linked);

      expect(resolveSlug(undefined, primary)).toBe("main");
      expect(resolveSlug(undefined, linked)).toBe("derive-me");
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
