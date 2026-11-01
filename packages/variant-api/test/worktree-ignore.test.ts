import { describe, expect, it } from "bun:test";
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { loadConfig } from "variant-config";
import { ensureWorktree } from "../src/worktree.js";

const git = (cwd: string, ...args: string[]): string =>
  execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8" }).trim();

/** A repository `<parent>/repo` with one commit on `main`, removed afterwards. */
const withRepo = (run: (repo: string, parent: string) => void, ignore?: string): void => {
  const parent = realpathSync(mkdtempSync(join("/tmp", "variant-ignore-")));
  const repo = join(parent, "repo");
  try {
    execFileSync("git", ["init", "-q", "-b", "main", repo]);
    git(repo, "config", "user.email", "variant@example.test");
    git(repo, "config", "user.name", "Variant Tests");
    writeFileSync(join(repo, "README.md"), "test\n");
    writeFileSync(join(repo, "AGENTS.md"), "# agents\n");
    git(repo, "add", "README.md", "AGENTS.md");
    git(repo, "commit", "-q", "-m", "initial");
    if (ignore !== undefined) {
      writeFileSync(join(repo, ".gitignore"), ignore);
    }
    run(repo, parent);
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
};

const ignoreOf = (repo: string): string => readFileSync(join(repo, ".gitignore"), "utf8");

describe("git-ignoring worktrees inside the checkout", () => {
  it("appends _v-* to an existing .gitignore, keeping its content", () => {
    withRepo((repo) => {
      ensureWorktree("foo", repo, repo);

      expect(ignoreOf(repo)).toBe("node_modules\n_v-*\n");
      expect(git(repo, "status", "--porcelain", "--", "_v-foo")).toBe("");
    }, "node_modules\n");
  });

  it("adds the line on its own when the file has no final newline", () => {
    withRepo((repo) => {
      ensureWorktree("foo", repo, repo);

      expect(ignoreOf(repo)).toBe("dist\n_v-*\n");
    }, "dist");
  });

  it("adds the entry once for several worktrees", () => {
    withRepo((repo) => {
      ensureWorktree("foo", repo, repo);
      ensureWorktree("bar", repo, repo);

      expect(ignoreOf(repo)).toBe("_v-*\n");
    }, "");
  });

  it.each(["_v-*", "/_v-*", "_v-*/", "/_v-*/"])("keeps a .gitignore that already has %s", (entry) => {
    withRepo((repo) => {
      ensureWorktree("foo", repo, repo);

      expect(ignoreOf(repo)).toBe(`dist\n${entry}\n`);
    }, `dist\n${entry}\n`);
  });

  it("does not take a comment for the entry", () => {
    withRepo((repo) => {
      ensureWorktree("foo", repo, repo);

      expect(ignoreOf(repo)).toBe("# _v-*\n_v-*\n");
    }, "# _v-*\n");
  });

  it("uses the configured prefix", () => {
    withRepo((repo) => {
      ensureWorktree("foo", repo, repo, "_work-");

      expect(ignoreOf(repo)).toBe("_work-*\n");
    }, "");
  });

  it("creates no .gitignore", () => {
    withRepo((repo) => {
      ensureWorktree("foo", repo, repo);

      expect(existsSync(join(repo, ".gitignore"))).toBe(false);
    });
  });

  it("leaves the .gitignore alone when the worktree root is outside the main tree", () => {
    withRepo((repo, parent) => {
      const destination = ensureWorktree("foo", repo, parent);

      expect(destination).toBe(join(parent, "_v-foo"));
      expect(ignoreOf(repo)).toBe("dist\n");
    }, "dist\n");
  });

  it("adds the worktree to the repository of main when started from another directory", () => {
    withRepo((repo, parent) => {
      const elsewhere = join(parent, "elsewhere");
      mkdirSync(elsewhere);

      const destination = ensureWorktree("foo", elsewhere, parent, "_v-", undefined, repo);

      expect(destination).toBe(join(parent, "_v-foo"));
      expect(git(destination, "branch", "--show-current")).toBe("feat/foo");
      expect(git(repo, "worktree", "list")).toContain("_v-foo");
    });
  });

  it("creates the worktree in the symlink's directory for the workspace layout", () => {
    withRepo((repo, parent) => {
      symlinkSync(join(repo, "AGENTS.md"), join(parent, "AGENTS.md"));
      const { variant } = loadConfig({ cwd: repo, env: {} });

      const destination = ensureWorktree("foo", repo, variant.root, variant.prefix, variant, variant.main);

      expect(destination).toBe(join(parent, "_v-foo"));
      expect(ignoreOf(repo)).toBe("dist\n");
    }, "dist\n");
  });

  it("creates the worktree inside the main tree and ignores it without a symlink", () => {
    withRepo((repo) => {
      const { variant } = loadConfig({ cwd: repo, env: {} });

      const destination = ensureWorktree("foo", repo, variant.root, variant.prefix, variant, variant.main);

      expect(destination).toBe(join(repo, "_v-foo"));
      expect(ignoreOf(repo)).toBe("dist\n_v-*\n");
    }, "dist\n");
  });
});
