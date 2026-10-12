import { describe, expect, it } from "bun:test";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { ensureWorktree } from "../src/worktree.js";

const git = (cwd: string, ...args: string[]): string =>
  execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8" }).trim();

describe("worktree coupling", () => {
  it("creates a sibling _v-slug worktree on a feature branch", () => {
    const parent = mkdtempSync(join("/tmp", "variant-worktree-parent-"));
    const repo = join(parent, "repo");
    let destination: string | undefined;
    try {
      execFileSync("git", ["init", "-b", "main", repo], { encoding: "utf8" });
      git(repo, "config", "user.email", "variant@example.test");
      git(repo, "config", "user.name", "Variant Tests");
      writeFileSync(join(repo, "README.md"), "test\n");
      git(repo, "add", "README.md");
      git(repo, "commit", "-m", "initial");

      destination = ensureWorktree("feature-one", repo);
      expect(destination).toBe(join(realpathSync(repo), "_v-feature-one"));
      expect(existsSync(join(destination, "README.md"))).toBe(true);
      expect(basename(destination)).toBe("_v-feature-one");
    } finally {
      if (destination && existsSync(destination)) {
        git(repo, "worktree", "remove", "--force", destination);
      }
      rmSync(parent, { recursive: true, force: true });
    }
  });

  it("uses an explicit variant root for worktree placement", () => {
    const parent = mkdtempSync(join("/tmp", "variant-worktree-root-"));
    const repo = join(parent, "repo");
    const variantRoot = join(parent, "variants");
    let destination: string | undefined;
    try {
      execFileSync("git", ["init", "-b", "main", repo], { encoding: "utf8" });
      git(repo, "config", "user.email", "variant@example.test");
      git(repo, "config", "user.name", "Variant Tests");
      writeFileSync(join(repo, "README.md"), "test\n");
      git(repo, "add", "README.md");
      git(repo, "commit", "-m", "initial");

      destination = ensureWorktree("feature-two", repo, variantRoot);
      expect(destination).toBe(join(variantRoot, "_v-feature-two"));
      expect(existsSync(join(destination, "README.md"))).toBe(true);
    } finally {
      if (destination && existsSync(destination)) {
        git(repo, "worktree", "remove", "--force", destination);
      }
      rmSync(parent, { recursive: true, force: true });
    }
  });

  it("names the worktree with a configured prefix", () => {
    const parent = mkdtempSync(join("/tmp", "variant-worktree-prefix-"));
    const repo = join(parent, "repo");
    let destination: string | undefined;
    try {
      execFileSync("git", ["init", "-b", "main", repo], { encoding: "utf8" });
      git(repo, "config", "user.email", "variant@example.test");
      git(repo, "config", "user.name", "Variant Tests");
      writeFileSync(join(repo, "README.md"), "test\n");
      git(repo, "add", "README.md");
      git(repo, "commit", "-m", "initial");

      destination = ensureWorktree("feature-three", repo, undefined, "_work-");
      expect(basename(destination)).toBe("_work-feature-three");
      expect(existsSync(join(destination, "README.md"))).toBe(true);
    } finally {
      if (destination && existsSync(destination)) {
        git(repo, "worktree", "remove", "--force", destination);
      }
      rmSync(parent, { recursive: true, force: true });
    }
  });
});
