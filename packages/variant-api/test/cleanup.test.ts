/**
 * Specification: openspec/specs/variant-api/node-runtime/spec.md (Implode cleanup patterns on both runtimes)
 */
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { removeMatching } from "../src/cleanup.js";

let parent: string;
let worktree: string;

const put = (root: string, path: string, content = "x\n"): void => {
  mkdirSync(join(root, path, ".."), { recursive: true });
  writeFileSync(join(root, path), content);
};

beforeEach(() => {
  parent = realpathSync(mkdtempSync(join("/tmp", "variant-cleanup-")));
  worktree = join(parent, "tree");
  execFileSync("git", ["init", "-q", "-b", "main", worktree]);
  execFileSync("git", ["-C", worktree, "config", "user.email", "variant@example.test"]);
  execFileSync("git", ["-C", worktree, "config", "user.name", "Variant Tests"]);
  put(worktree, "tracked/keep.js");
  execFileSync("git", ["-C", worktree, "add", "."]);
  execFileSync("git", ["-C", worktree, "commit", "-q", "-m", "init"]);
});

afterEach(() => {
  rmSync(parent, { recursive: true, force: true });
});

describe("removeMatching", () => {
  const removeFromRoot = (patterns: string[]) => removeMatching(worktree, [worktree], patterns, "demo");

  it("removes files matching a wildcard and replaces the slug", () => {
    put(worktree, "rec/demo/pr7-demo.webm");
    put(worktree, "rec/demo/notes.txt");

    const removed = removeFromRoot(["rec/${slug}/pr*-demo.webm"]);

    expect(removed).toEqual(["rec/demo/pr7-demo.webm"]);
    expect(existsSync(join(worktree, "rec/demo/pr7-demo.webm"))).toBe(false);
    expect(existsSync(join(worktree, "rec/demo/notes.txt"))).toBe(true);
  });

  it("matches one character and character classes", () => {
    put(worktree, "a1.log");
    put(worktree, "a22.log");
    put(worktree, "b1.log");

    const removed = removeFromRoot(["?1.log", "[b]*.log"]);

    expect(removed.sort()).toEqual(["a1.log", "b1.log"]);
    expect(existsSync(join(worktree, "a22.log"))).toBe(true);
  });

  it("matches brace alternatives and dotfiles", () => {
    put(worktree, "out/a/b.js");
    put(worktree, "dist/c.js");
    put(worktree, ".cache/d");
    put(worktree, "src/keep.js");

    removeFromRoot(["{out,dist}/**", ".cache/*"]);

    expect(existsSync(join(worktree, "out/a/b.js"))).toBe(false);
    expect(existsSync(join(worktree, "dist/c.js"))).toBe(false);
    expect(existsSync(join(worktree, ".cache/d"))).toBe(false);
    expect(existsSync(join(worktree, "src/keep.js"))).toBe(true);
  });

  it("removes a whole directory by its name", () => {
    put(worktree, "node_modules/dep/index.js");

    expect(removeFromRoot(["node_modules"])).toEqual(["node_modules"]);
    expect(existsSync(join(worktree, "node_modules"))).toBe(false);
  });

  it("matches from every base directory", () => {
    put(worktree, "fe/dist/a.js");
    put(worktree, "be/dist/b.js");

    const removed = removeMatching(worktree, [worktree, join(worktree, "fe"), join(worktree, "be")], ["dist"], "demo");

    expect(removed.sort()).toEqual(["be/dist", "fe/dist"]);
  });

  it("keeps a tracked file that matches a pattern", () => {
    put(worktree, "tracked/new.js");

    const removed = removeFromRoot(["tracked/*.js"]);

    expect(removed).toEqual(["tracked/new.js"]);
    expect(existsSync(join(worktree, "tracked/keep.js"))).toBe(true);
  });

  it("keeps a matching directory that holds a tracked file", () => {
    put(worktree, "tracked/new.js");

    expect(removeFromRoot(["tracked"])).toEqual([]);
    expect(existsSync(join(worktree, "tracked/new.js"))).toBe(true);
  });

  it("never removes .git", () => {
    removeFromRoot(["*", ".*", ".git"]);

    expect(existsSync(join(worktree, ".git"))).toBe(true);
  });

  it("does not follow symlinks", () => {
    put(parent, "outside/file.txt");
    symlinkSync(join(parent, "outside"), join(worktree, "link"));

    removeFromRoot(["link/**"]);

    expect(existsSync(join(parent, "outside/file.txt"))).toBe(true);
  });

  it("ignores a match outside the worktree", () => {
    put(parent, "outside.txt");

    const removed = removeFromRoot(["../outside.txt", "../*.txt"]);

    expect(removed).toEqual([]);
    expect(existsSync(join(parent, "outside.txt"))).toBe(true);
  });
});
