import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createCommitWatcher, headReflogPath, isCommitEntry } from "./onboarding-commits.ts";

/** Specification: onboarding (One-time onboarding notification): which reflog entries are a local commit. */

let base: string;

beforeEach(() => {
  base = realpathSync(mkdtempSync(join("/tmp", "variant-commits-")));
});

afterEach(() => {
  rmSync(base, { recursive: true, force: true });
});

const GIT_ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: "t",
  GIT_AUTHOR_EMAIL: "t@example.com",
  GIT_COMMITTER_NAME: "t",
  GIT_COMMITTER_EMAIL: "t@example.com",
  GIT_CONFIG_GLOBAL: "/dev/null",
  GIT_CONFIG_SYSTEM: "/dev/null",
};

const git = (cwd: string, ...args: string[]): string =>
  execFileSync("git", ["-c", "commit.gpgsign=false", "-c", "init.defaultBranch=main", ...args], {
    cwd,
    env: GIT_ENV,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

const commit = (cwd: string, name: string, message = name): void => {
  writeFileSync(join(cwd, name), name);
  git(cwd, "add", name);
  git(cwd, "commit", "-m", message);
};

const repository = (name = "repo"): string => {
  const path = join(base, name);
  execFileSync("mkdir", ["-p", path]);
  git(path, "init", "-q");
  return path;
};

/** A watcher that notices nothing by itself: the test calls `check` after each git operation. */
const watcher = (root: string) => {
  let commits = 0;
  const handle = createCommitWatcher({ root, onCommit: () => (commits += 1), watch: () => ({ dispose: () => {} }) });
  return { handle, commits: () => commits };
};

describe("isCommitEntry", () => {
  const entry = (message: string): string => `0000 1111 t <t@example.com> 1700000000 +0000\t${message}`;

  it.each(["commit: add", "commit (initial): first", "commit (amend): fix"])("counts %p", (message) => {
    expect(isCommitEntry(entry(message))).toBe(true);
  });

  it.each([
    "commit (merge): Merge x",
    "pull: Fast-forward",
    "merge feature: Fast-forward",
    "rebase (finish): returning to refs/heads/main",
    "checkout: moving from main to feature",
    "clone: from /path",
    "reset: moving to HEAD~1",
  ])("does not count %p", (message) => {
    expect(isCommitEntry(entry(message))).toBe(false);
  });
});

describe("createCommitWatcher", () => {
  it("fires for a local commit", () => {
    const root = repository();
    commit(root, "a");
    const { handle, commits } = watcher(root);

    commit(root, "b");
    handle.check();

    expect(commits()).toBe(1);
  });

  it("ignores the commits that exist at the start", () => {
    const root = repository();
    commit(root, "a");
    const { handle, commits } = watcher(root);

    handle.check();

    expect(commits()).toBe(0);
  });

  it("fires for the initial commit, in a repository that has no reflog yet", () => {
    const root = repository();
    const { handle, commits } = watcher(root);

    commit(root, "a");
    handle.check();

    expect(commits()).toBe(1);
  });

  it("fires for an amend", () => {
    const root = repository();
    commit(root, "a");
    const { handle, commits } = watcher(root);

    git(root, "commit", "--amend", "-m", "again");
    handle.check();

    expect(commits()).toBe(1);
  });

  it("fires once for one commit however often it checks", () => {
    const root = repository();
    commit(root, "a");
    const { handle, commits } = watcher(root);

    commit(root, "b");
    handle.check();
    handle.check();

    expect(commits()).toBe(1);
  });

  it("does not fire for a pull", () => {
    const origin = repository("origin");
    commit(origin, "a");
    const clone = join(base, "clone");
    git(base, "clone", "-q", origin, clone);
    const { handle, commits } = watcher(clone);

    commit(origin, "b");
    git(clone, "pull", "-q");
    handle.check();

    expect(commits()).toBe(0);
  });

  it("does not fire for a clone", () => {
    const origin = repository("origin");
    commit(origin, "a");
    const clone = join(base, "clone");
    git(base, "clone", "-q", origin, clone);

    const { handle, commits } = watcher(clone);
    handle.check();

    expect(commits()).toBe(0);
  });

  it("does not fire for a merge or a checkout", () => {
    const root = repository();
    commit(root, "a");
    git(root, "branch", "feature");
    const { handle, commits } = watcher(root);

    git(root, "checkout", "-q", "feature");
    commit(root, "f");
    handle.check();
    expect(commits()).toBe(1);

    git(root, "checkout", "-q", "main");
    handle.check();
    git(root, "merge", "-q", "feature");
    handle.check();

    expect(commits()).toBe(1);
  });

  it("does not fire for a rebase that ends on a commit entry", () => {
    const root = repository();
    commit(root, "a");
    git(root, "checkout", "-q", "-b", "feature");
    commit(root, "f");
    git(root, "checkout", "-q", "main");
    commit(root, "m");
    git(root, "checkout", "-q", "feature");
    const { handle, commits } = watcher(root);

    git(root, "rebase", "-q", "main");
    handle.check();

    expect(commits()).toBe(0);
  });

  it("watches the reflog of a linked worktree", () => {
    const root = repository();
    commit(root, "a");
    const linked = join(base, "linked");
    git(root, "worktree", "add", "-q", "-b", "feature", linked);
    const { handle, commits } = watcher(linked);
    expect(headReflogPath(linked)).toContain(join("worktrees"));

    commit(linked, "l");
    handle.check();

    expect(commits()).toBe(1);
  });

  it("does nothing outside a repository", () => {
    const { handle, commits } = watcher(base);

    handle.check();
    handle.dispose();

    expect(commits()).toBe(0);
  });

  it("watches the logs directory, or the git directory until it exists", () => {
    const root = repository();
    const watched: string[] = [];
    const handle = createCommitWatcher({
      root,
      onCommit: () => {},
      watch: (directory) => {
        watched.push(directory);
        return { dispose: () => {} };
      },
    });

    commit(root, "a");
    handle.check();

    expect(watched).toEqual([join(root, ".git"), join(root, ".git", "logs")]);
  });
});
