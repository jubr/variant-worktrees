import { describe, expect, it } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { resolveSlug, sanitizeSlug } from "../src/slug.js";
import { ensureWorktree } from "../src/worktree.js";

const git = (cwd: string, ...args: string[]): string =>
  execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8" }).trim();

/** A repository with one commit on `main`, removed afterwards. */
const withRepo = (run: (repo: string) => void): void => {
  const parent = realpathSync(mkdtempSync(join("/tmp", "variant-branches-")));
  const repo = join(parent, "repo");
  try {
    execFileSync("git", ["init", "-q", "-b", "main", repo]);
    git(repo, "config", "user.email", "variant@example.test");
    git(repo, "config", "user.name", "Variant Tests");
    writeFileSync(join(repo, "README.md"), "test\n");
    git(repo, "add", "README.md");
    git(repo, "commit", "-q", "-m", "initial");
    run(repo);
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
};

describe("slug derivation with configured prefixes", () => {
  it("removes every configured prefix and feature/ from a branch name", () => {
    expect(sanitizeSlug("task/Add Auth", ["task/"])).toBe("add-auth");
    expect(sanitizeSlug("refs/heads/feature/Add Auth", ["task/"])).toBe("add-auth");
  });

  it("keeps the feat/ and fix/ defaults for callers that pass nothing", () => {
    expect(sanitizeSlug("fix/BUG_42")).toBe("bug-42");
    expect(sanitizeSlug("task/add-auth")).toBe("task-add-auth");
  });

  it("derives the slug of a worktree from its branch with the configured prefix", () => {
    withRepo((repo) => {
      git(repo, "worktree", "add", "-q", "-b", "task/add-auth", join(repo, "..", "wt"));

      expect(resolveSlug(undefined, join(repo, "..", "wt"), ["task/"])).toBe("add-auth");
    });
  });
});

describe("worktree branches", () => {
  const branches = { baseBranch: "develop", branchPrefixes: ["task/", "fix/"] };

  it("starts a new branch with the first prefix from the base branch", () => {
    withRepo((repo) => {
      git(repo, "switch", "-q", "-c", "develop");
      writeFileSync(join(repo, "develop.txt"), "develop\n");
      git(repo, "add", "develop.txt");
      git(repo, "commit", "-q", "-m", "develop work");
      git(repo, "switch", "-q", "main");

      const destination = ensureWorktree("add-auth", repo, undefined, undefined, branches);

      expect(git(destination, "branch", "--show-current")).toBe("task/add-auth");
      expect(git(destination, "rev-parse", "HEAD")).toBe(git(repo, "rev-parse", "develop"));
    });
  });

  it("checks out an existing branch that has another configured prefix", () => {
    withRepo((repo) => {
      git(repo, "branch", "fix/add-auth");
      git(repo, "branch", "develop");

      const destination = ensureWorktree("add-auth", repo, undefined, undefined, branches);

      expect(git(destination, "branch", "--show-current")).toBe("fix/add-auth");
    });
  });

  it("uses main and feat/ for callers that pass nothing", () => {
    withRepo((repo) => {
      const destination = ensureWorktree("add-auth", repo);

      expect(git(destination, "branch", "--show-current")).toBe("feat/add-auth");
    });
  });
});
