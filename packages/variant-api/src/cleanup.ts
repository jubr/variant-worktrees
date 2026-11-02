import { existsSync, rmSync } from "node:fs";
import { basename, isAbsolute, join, relative, resolve } from "node:path";
import { globSync } from "tinyglobby";
import { git, runGit } from "./git.js";

/**
 * Deletes every path below `worktree` that matches one of `patterns` (`{{slug}}` replaced), matched from each of
 * `bases`. Returns the removed paths relative to `worktree`. A match that is, or contains, a tracked file stays; so does `.git`. Symlinks are not followed.
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
  for (const base of new Set(bases)) {
    for (const pattern of patterns) {
      for (const found of globSync(pattern.replaceAll("{{slug}}", slug), {
        cwd: base,
        dot: true,
        onlyFiles: false,
        // AIDEV-NOTE: matched literally, symlinks not followed: what Bun.Glob did before this ran on Node too.
        expandDirectories: false,
        followSymbolicLinks: false,
      })) {
        const match = found.replace(/\/+$/, "");
        const inside = relative(worktree, resolve(base, match));
        if (inside === "" || inside.startsWith("..") || isAbsolute(inside) || basename(match) === ".git") {
          continue;
        }
        if (
          existsSync(join(base, match)) &&
          git(base, ["--literal-pathspecs", "ls-files", "--", match]).trim() === ""
        ) {
          rmSync(join(base, match), { recursive: true, force: true });
          removed.push(inside);
        }
      }
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
