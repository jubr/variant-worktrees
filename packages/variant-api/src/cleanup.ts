import { existsSync, rmSync } from "node:fs";
import { basename, isAbsolute, join, relative, resolve } from "node:path";
import { globSync } from "tinyglobby";
import { git, runGit } from "./git.js";

/**
 * The paths below `worktree` that match one of `patterns` (`{{slug}}` replaced), matched from each of `bases`, and that
 * `removeMatching` would delete: not `.git`, not a tracked file, not a directory that holds one. Symlinks are not
 * followed. Paths are relative to `worktree`; nothing is deleted.
 */
export const findRemovable = (
  worktree: string,
  bases: readonly string[],
  patterns: readonly string[],
  slug: string,
): Array<{ base: string; match: string; path: string }> => {
  const found: Array<{ base: string; match: string; path: string }> = [];
  for (const base of new Set(bases)) {
    for (const pattern of patterns) {
      for (const entry of globSync(pattern.replaceAll("{{slug}}", slug), {
        cwd: base,
        dot: true,
        onlyFiles: false,
        // AIDEV-NOTE: matched literally, symlinks not followed: what Bun.Glob did before this ran on Node too.
        expandDirectories: false,
        followSymbolicLinks: false,
      })) {
        const match = entry.replace(/\/+$/, "");
        const path = relative(worktree, resolve(base, match));
        if (path === "" || path.startsWith("..") || isAbsolute(path) || basename(match) === ".git") {
          continue;
        }
        if (git(base, ["--literal-pathspecs", "ls-files", "--", match]).trim() === "") {
          found.push({ base, match, path });
        }
      }
    }
  }
  return found;
};

/**
 * Deletes every path below `worktree` that `findRemovable` reports. Returns the removed paths relative to `worktree`.
 *
 * Specification: openspec/specs/variant-api/node-runtime/spec.md (Implode cleanup patterns on both runtimes)
 */
export const removeMatching = (
  worktree: string,
  bases: readonly string[],
  patterns: readonly string[],
  slug: string,
): string[] => {
  const removed: string[] = [];
  for (const { base, match, path } of findRemovable(worktree, bases, patterns, slug)) {
    if (existsSync(join(base, match))) {
      rmSync(join(base, match), { recursive: true, force: true });
      removed.push(path);
    }
  }
  return removed;
};

/** What would be lost with the worktree: `git status`, `git diff --stat` and, when short enough, `git diff`. */
export const worktreeReport = (worktree: string, maxDiffLines: number): string => {
  const status = git(worktree, ["status"]);
  const stat = git(worktree, ["diff", "--stat"]);
  const diff = git(worktree, ["diff"]);
  const full = (diff === "" ? 0 : diff.trimEnd().split("\n").length) <= maxDiffLines;
  return [status, stat, ...(full && diff !== "" ? [diff] : [])]
    .map((part) => part.trimEnd())
    .filter((part) => part !== "")
    .join("\n\n");
};

/** Discards the local modifications of tracked files whose base name is in `names`. */
export const restoreTracked = (worktree: string, names: readonly string[]): string[] => {
  const modified = git(worktree, ["ls-files", "-m"])
    .split("\n")
    .filter((file) => file !== "" && names.includes(basename(file)));
  if (modified.length > 0) {
    git(worktree, ["checkout", "--", ...modified]);
  }
  return modified;
};

/** Whether `HEAD` of `worktree` is contained in `origin/<base>`, or in `<base>` when there is no such remote branch. */
export const isMerged = (worktree: string, base: string): { merged: boolean; into: string } => {
  const remote = `origin/${base}`;
  const into = runGit(worktree, ["rev-parse", "--verify", "--quiet", `refs/remotes/${remote}`]).ok ? remote : base;
  return { merged: runGit(worktree, ["merge-base", "--is-ancestor", "HEAD", into]).ok, into };
};

/** Removes the worktree from git; `force` also removes one with local changes. */
export const removeWorktree = (primary: string, worktree: string, force: boolean): void => {
  git(primary, ["worktree", "remove", ...(force ? ["--force"] : []), worktree]);
};
