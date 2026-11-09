import { describe, expect, it } from "bun:test";
import { execFileSync } from "node:child_process";
import { chmodSync, existsSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ensureWorktree, type PullFfOptions } from "./worktree.js";

const git = (cwd: string, ...args: string[]): string => {
  try {
    return execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  } catch (error) {
    const failed = error as { stderr?: string };
    throw new Error((failed.stderr ?? "").trim() || String(error));
  }
};

const variantsOf = (repo: string): string => join(repo, "..", "variants");

const create = (repo: string, slug: string, from?: string, pull?: PullFfOptions): string =>
  ensureWorktree(slug, repo, variantsOf(repo), undefined, undefined, undefined, from, pull);

/** Primary clone that tracks `origin/main`. */
const withOrigin = (run: (repo: string, origin: string) => void): void => {
  const parent = realpathSync(mkdtempSync(join("/tmp", "variant-pull-ff-")));
  const origin = join(parent, "origin.git");
  const repo = join(parent, "repo");
  try {
    execFileSync("git", ["init", "-q", "-b", "main", repo]);
    git(repo, "config", "user.email", "variant@example.test");
    git(repo, "config", "user.name", "Variant Tests");
    writeFileSync(join(repo, "README.md"), "test\n");
    git(repo, "add", "README.md");
    git(repo, "commit", "-q", "-m", "initial");
    execFileSync("git", ["init", "-q", "--bare", "-b", "main", origin]);
    git(repo, "remote", "add", "origin", origin);
    git(repo, "push", "-q", "-u", "origin", "main");
    run(repo, origin);
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
};

/** Commit on `origin/<branch>` from a second clone so `repo` stays stale until it fetches. */
const pushAhead = (origin: string, body: string, file = "ahead.txt", branch = "main"): void => {
  const parent = realpathSync(mkdtempSync(join("/tmp", "variant-pull-ff-ahead-")));
  const clone = join(parent, "ahead");
  try {
    execFileSync("git", ["clone", "-q", "--branch", branch, origin, clone]);
    git(clone, "config", "user.email", "variant@example.test");
    git(clone, "config", "user.name", "Variant Tests");
    writeFileSync(join(clone, file), body);
    git(clone, "add", file);
    git(clone, "commit", "-q", "-m", "ahead");
    git(clone, "push", "-q", "origin", branch);
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
};

const messageOf = (run: () => void): string => {
  try {
    run();
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
  throw new Error("expected the call to fail");
};

describe("pullFf", () => {
  const pull = { pullFf: true } satisfies PullFfOptions;

  it("fast-forwards a checked-out main before the new branch exists", () => {
    withOrigin((repo, origin) => {
      const before = git(repo, "rev-parse", "HEAD");
      pushAhead(origin, "remote\n");

      const destination = create(repo, "add-auth", undefined, pull);

      const updated = git(repo, "rev-parse", "HEAD");
      expect(updated).not.toBe(before);
      expect(updated).toBe(git(origin, "rev-parse", "main"));
      expect(git(destination, "rev-parse", "HEAD")).toBe(updated);
      expect(git(destination, "branch", "--show-current")).toBe("feat/add-auth");
      expect(git(repo, "branch", "--show-current")).toBe("main");
    });
  });

  it("restores local modifications after the fast-forward", () => {
    withOrigin((repo, origin) => {
      pushAhead(origin, "remote\n");
      writeFileSync(join(repo, "README.md"), "local\n");

      const destination = create(repo, "add-auth", undefined, pull);

      expect(readFileSync(join(repo, "README.md"), "utf8")).toBe("local\n");
      expect(existsSync(join(repo, "ahead.txt"))).toBe(true);
      expect(git(destination, "rev-parse", "HEAD")).toBe(git(repo, "rev-parse", "HEAD"));
    });
  });

  it("fast-forwards primary main when the caller is another worktree", () => {
    withOrigin((repo, origin) => {
      const other = create(repo, "other");
      const otherHead = git(other, "rev-parse", "HEAD");
      pushAhead(origin, "remote\n");

      const destination = ensureWorktree(
        "add-auth",
        other,
        variantsOf(repo),
        undefined,
        undefined,
        undefined,
        undefined,
        pull,
      );

      expect(git(repo, "rev-parse", "HEAD")).toBe(git(origin, "rev-parse", "main"));
      expect(git(other, "rev-parse", "HEAD")).toBe(otherHead);
      expect(git(destination, "rev-parse", "HEAD")).toBe(git(repo, "rev-parse", "HEAD"));
    });
  });

  it("fast-forwards a start branch that is not checked out", () => {
    withOrigin((repo, origin) => {
      git(repo, "switch", "-q", "-c", "side");
      const side = git(repo, "rev-parse", "HEAD");
      const readme = readFileSync(join(repo, "README.md"), "utf8");
      pushAhead(origin, "remote\n");

      const destination = create(repo, "add-auth", undefined, pull);

      expect(git(repo, "rev-parse", "main")).toBe(git(origin, "rev-parse", "main"));
      expect(git(repo, "branch", "--show-current")).toBe("side");
      expect(git(repo, "rev-parse", "HEAD")).toBe(side);
      expect(readFileSync(join(repo, "README.md"), "utf8")).toBe(readme);
      expect(existsSync(join(repo, "ahead.txt"))).toBe(false);
      expect(git(destination, "rev-parse", "HEAD")).toBe(git(origin, "rev-parse", "main"));
    });
  });

  it("fast-forwards the branch named by from and does not pull the new branch", () => {
    withOrigin((repo, origin) => {
      git(repo, "switch", "-q", "-c", "feat/other");
      git(repo, "push", "-q", "-u", "origin", "feat/other");
      pushAhead(origin, "remote\n", "other.txt", "feat/other");

      const destination = create(repo, "add-auth", "feat/other", pull);

      expect(git(repo, "rev-parse", "HEAD")).toBe(git(origin, "rev-parse", "feat/other"));
      expect(git(destination, "rev-parse", "HEAD")).toBe(git(repo, "rev-parse", "HEAD"));
      expect(git(destination, "branch", "--show-current")).toBe("feat/add-auth");
      expect(() => git(destination, "rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}")).toThrow();
    });
  });

  it("does not fetch when from is a tag, a commit, or HEAD", () => {
    withOrigin((repo) => {
      git(repo, "branch", "--unset-upstream");
      const sha = git(repo, "rev-parse", "HEAD");
      git(repo, "tag", "start-here");

      expect(git(create(repo, "from-sha", sha, pull), "rev-parse", "HEAD")).toBe(sha);
      expect(git(create(repo, "from-tag", "start-here", pull), "rev-parse", "HEAD")).toBe(sha);
      expect(git(create(repo, "from-head", "HEAD", pull), "rev-parse", "HEAD")).toBe(sha);
    });
  });

  it("leaves a diverged main un-pulled and names the retry command", () => {
    withOrigin((repo, origin) => {
      pushAhead(origin, "remote\n");
      writeFileSync(join(repo, "local.txt"), "local\n");
      git(repo, "add", "local.txt");
      git(repo, "commit", "-q", "-m", "local only");
      const tip = git(repo, "rev-parse", "HEAD");

      const message = messageOf(() => create(repo, "add-auth", undefined, pull));

      expect(message).toContain("main has diverged");
      expect(message).toContain("variant create --pull-ff --slug add-auth");
      expect(git(repo, "rev-parse", "HEAD")).toBe(tip);
      expect(existsSync(join(variantsOf(repo), "_v-add-auth"))).toBe(false);
      expect(() => git(repo, "show-ref", "--verify", "--quiet", "refs/heads/feat/add-auth")).toThrow();
    });
  });

  it("stops before a conflicting fast-forward and leaves local modifications", () => {
    withOrigin((repo, origin) => {
      const tip = git(repo, "rev-parse", "HEAD");
      pushAhead(origin, "remote\n", "README.md");
      writeFileSync(join(repo, "README.md"), "local\n");

      const message = messageOf(() => create(repo, "add-auth", undefined, pull));

      expect(message).toContain("conflict");
      expect(message).toContain("variant create --pull-ff --slug add-auth");
      expect(git(repo, "rev-parse", "HEAD")).toBe(tip);
      expect(readFileSync(join(repo, "README.md"), "utf8")).toBe("local\n");
      expect(readFileSync(join(repo, "README.md"), "utf8")).not.toContain("<<<<<<<");
      expect(existsSync(join(variantsOf(repo), "_v-add-auth"))).toBe(false);
    });
  });

  it("restores the checkout when the fast-forward fails after a clean dry-run", () => {
    withOrigin((repo, origin) => {
      const tip = git(repo, "rev-parse", "HEAD");
      writeFileSync(join(repo, "README.md"), "local\n");
      pushAhead(origin, "remote\n");
      const hook = join(repo, ".git", "hooks", "reference-transaction");
      writeFileSync(
        hook,
        '#!/bin/sh\n[ "$1" = prepared ] || exit 0\nwhile read -r _old _new ref; do\n  case "$ref" in refs/heads/*) exit 1 ;; esac\ndone\nexit 0\n',
      );
      chmodSync(hook, 0o755);

      const message = messageOf(() => create(repo, "add-auth", undefined, pull));

      expect(message).toContain("failed");
      expect(message).toContain("variant create --pull-ff --slug add-auth");
      expect(git(repo, "rev-parse", "HEAD")).toBe(tip);
      expect(readFileSync(join(repo, "README.md"), "utf8")).toBe("local\n");
      expect(readFileSync(join(repo, "README.md"), "utf8")).not.toContain("<<<<<<<");
      expect(existsSync(join(variantsOf(repo), "_v-add-auth"))).toBe(false);
    });
  });

  it("names a missing upstream and the retry command", () => {
    withOrigin((repo) => {
      git(repo, "branch", "--unset-upstream");
      const tip = git(repo, "rev-parse", "HEAD");

      const message = messageOf(() => create(repo, "add-auth", undefined, pull));

      expect(message).toContain("main has no upstream");
      expect(message).toContain("variant create --pull-ff --slug add-auth");
      expect(git(repo, "rev-parse", "HEAD")).toBe(tip);
      expect(existsSync(join(variantsOf(repo), "_v-add-auth"))).toBe(false);
    });
  });

  it("keeps from on the retry command", () => {
    withOrigin((repo) => {
      git(repo, "switch", "-q", "-c", "feat/other");

      const message = messageOf(() => create(repo, "demo", "feat/other", pull));

      expect(message).toContain("variant create --pull-ff --from feat/other --slug demo");
    });
  });

  it("does not fetch for an existing worktree, an existing branch, slug main, or an omitted flag", () => {
    withOrigin((repo, origin) => {
      const existing = create(repo, "add-auth");
      const head = git(existing, "rev-parse", "HEAD");
      git(repo, "branch", "fix/kept");
      git(repo, "remote", "set-url", "origin", join(repo, "..", "missing-origin"));
      pushAhead(origin, "remote\n");
      const mainTip = git(repo, "rev-parse", "HEAD");

      expect(create(repo, "add-auth", undefined, pull)).toBe(existing);
      expect(git(existing, "rev-parse", "HEAD")).toBe(head);

      const kept = create(repo, "kept", undefined, pull);
      expect(git(kept, "branch", "--show-current")).toBe("fix/kept");

      expect(create(repo, "main", undefined, pull)).toBe(realpathSync(repo));

      git(repo, "remote", "set-url", "origin", origin);
      const omitted = ensureWorktree("fresh", repo, variantsOf(repo));
      expect(git(repo, "rev-parse", "HEAD")).toBe(mainTip);
      expect(git(omitted, "rev-parse", "HEAD")).toBe(mainTip);
    });
  });
});
