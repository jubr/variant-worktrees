import { describe, expect, it } from "bun:test";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
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

  it("starts a new branch at the commit from names", () => {
    withRepo((repo) => {
      const start = git(repo, "rev-parse", "HEAD");
      git(repo, "switch", "-q", "-c", "develop");
      writeFileSync(join(repo, "develop.txt"), "develop\n");
      git(repo, "add", "develop.txt");
      git(repo, "commit", "-q", "-m", "develop work");
      git(repo, "switch", "-q", "main");

      const destination = ensureWorktree("add-auth", repo, undefined, undefined, branches, undefined, start);

      expect(git(destination, "branch", "--show-current")).toBe("task/add-auth");
      expect(git(destination, "rev-parse", "HEAD")).toBe(start);
    });
  });

  it("resolves HEAD to the current worktree when that directory belongs to the repository", () => {
    withRepo((repo) => {
      const mainTip = git(repo, "rev-parse", "HEAD");
      const linked = join(repo, "..", "linked");
      git(repo, "worktree", "add", "-q", "-b", "side", linked);
      writeFileSync(join(linked, "side.txt"), "side\n");
      git(linked, "add", "side.txt");
      git(linked, "commit", "-q", "-m", "side work");
      const sideTip = git(linked, "rev-parse", "HEAD");

      const destination = ensureWorktree("add-auth", linked, undefined, undefined, branches, repo, "HEAD");

      expect(sideTip).not.toBe(mainTip);
      expect(git(destination, "branch", "--show-current")).toBe("task/add-auth");
      expect(git(destination, "rev-parse", "HEAD")).toBe(sideTip);
    });
  });

  it("resolves HEAD to variant.main when the working directory is not a checkout of the repository", () => {
    withRepo((repo) => {
      const mainTip = git(repo, "rev-parse", "HEAD");
      const linked = join(repo, "..", "linked");
      git(repo, "worktree", "add", "-q", "-b", "side", linked);
      writeFileSync(join(linked, "side.txt"), "side\n");
      git(linked, "add", "side.txt");
      git(linked, "commit", "-q", "-m", "side work");
      const elsewhere = join(repo, "..", "elsewhere");
      mkdirSync(elsewhere);

      const destination = ensureWorktree("add-auth", elsewhere, undefined, undefined, branches, repo, "HEAD");

      expect(git(linked, "rev-parse", "HEAD")).not.toBe(mainTip);
      expect(git(destination, "rev-parse", "HEAD")).toBe(mainTip);
    });
  });

  it("leaves no branch and no directory when from cannot be resolved", () => {
    withRepo((repo) => {
      git(repo, "branch", "develop");
      const root = join(repo, "..", "variants");

      expect(() => ensureWorktree("add-auth", repo, root, undefined, branches, undefined, "no-such-commit")).toThrow(
        /no-such-commit/,
      );
      expect(existsSync(join(root, "_v-add-auth"))).toBe(false);
      expect(existsSync(root)).toBe(false);
      expect(() => git(repo, "show-ref", "--verify", "--quiet", "refs/heads/task/add-auth")).toThrow();
    });
  });

  it("checks out an existing prefixed branch at its current HEAD when from names another commit", () => {
    withRepo((repo) => {
      git(repo, "branch", "fix/add-auth");
      const existing = git(repo, "rev-parse", "fix/add-auth");
      git(repo, "switch", "-q", "-c", "develop");
      writeFileSync(join(repo, "develop.txt"), "develop\n");
      git(repo, "add", "develop.txt");
      git(repo, "commit", "-q", "-m", "develop work");
      const develop = git(repo, "rev-parse", "HEAD");
      git(repo, "switch", "-q", "main");

      const destination = ensureWorktree("add-auth", repo, undefined, undefined, branches, undefined, develop);

      expect(develop).not.toBe(existing);
      expect(git(destination, "branch", "--show-current")).toBe("fix/add-auth");
      expect(git(destination, "rev-parse", "HEAD")).toBe(existing);
    });
  });

  it("reuses an existing worktree without moving its HEAD to from", () => {
    withRepo((repo) => {
      git(repo, "branch", "develop");
      const first = ensureWorktree("add-auth", repo, undefined, undefined, branches);
      const head = git(first, "rev-parse", "HEAD");
      git(repo, "switch", "-q", "-c", "side");
      writeFileSync(join(repo, "side.txt"), "side\n");
      git(repo, "add", "side.txt");
      git(repo, "commit", "-q", "-m", "side work");
      const side = git(repo, "rev-parse", "HEAD");
      git(repo, "switch", "-q", "main");

      const second = ensureWorktree("add-auth", repo, undefined, undefined, branches, undefined, side);

      expect(side).not.toBe(head);
      expect(second).toBe(realpathSync(first));
      expect(git(second, "rev-parse", "HEAD")).toBe(head);
    });
  });
});
