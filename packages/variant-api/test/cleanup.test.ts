/**
 * Specification: openspec/specs/variant-api/node-runtime/spec.md (Implode cleanup patterns on both runtimes)
 */
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { removeUntracked } from "../src/cleanup.js";

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

describe("removeUntracked", () => {
  it("removes files matching a wildcard and replaces the slug", () => {
    put(worktree, "rec/demo/pr7-demo.webm");
    put(worktree, "rec/demo/notes.txt");

    const removed = removeUntracked(worktree, ["rec/{{slug}}/pr*-demo.webm"], "demo");

    expect(removed).toEqual(["rec/demo/pr7-demo.webm"]);
    expect(existsSync(join(worktree, "rec/demo/pr7-demo.webm"))).toBe(false);
    expect(existsSync(join(worktree, "rec/demo/notes.txt"))).toBe(true);
  });

  it("matches one character and character classes", () => {
    put(worktree, "a1.log");
    put(worktree, "a22.log");
    put(worktree, "b1.log");

    const removed = removeUntracked(worktree, ["?1.log", "[b]*.log"], "demo");

    expect(removed.sort()).toEqual(["a1.log", "b1.log"]);
    expect(existsSync(join(worktree, "a22.log"))).toBe(true);
  });

  it("matches brace alternatives and dotfiles", () => {
    put(worktree, "out/a/b.js");
    put(worktree, "dist/c.js");
    put(worktree, ".cache/d");
    put(worktree, "src/keep.js");

    const removed = removeUntracked(worktree, ["{out,dist}/**", ".cache/*"], "demo");

    expect(removed.sort()).toEqual([".cache/d", "dist/c.js", "out/a/b.js"]);
    expect(existsSync(join(worktree, "src/keep.js"))).toBe(true);
  });

  it("keeps a tracked file that matches a pattern", () => {
    put(worktree, "tracked/new.js");

    const removed = removeUntracked(worktree, ["tracked/*.js"], "demo");

    expect(removed).toEqual(["tracked/new.js"]);
    expect(existsSync(join(worktree, "tracked/keep.js"))).toBe(true);
  });

  it("ignores a match outside the worktree", () => {
    put(parent, "outside.txt");

    const removed = removeUntracked(worktree, ["../outside.txt", "../*.txt"], "demo");

    expect(removed).toEqual([]);
    expect(existsSync(join(parent, "outside.txt"))).toBe(true);
  });
});
