import { existsSync, rmSync } from "node:fs";
import { basename, isAbsolute, join, relative, resolve } from "node:path";
import { git, runGit } from "./git.js";

/** Deletes the untracked files below `worktree` that match `patterns` (`{{slug}}` replaced); tracked files stay. */
export const removeUntracked = (worktree: string, patterns: readonly string[], slug: string): string[] => {
  const removed: string[] = [];
  for (const pattern of patterns) {
    for (const match of new Bun.Glob(pattern.replaceAll("{{slug}}", slug)).scanSync({ cwd: worktree, dot: true })) {
      const outside = relative(worktree, resolve(worktree, match));
      if (outside.startsWith("..") || isAbsolute(outside)) {
        continue;
      }
      if (git(worktree, ["--literal-pathspecs", "ls-files", "--", match]).trim() === "") {
        rmSync(join(worktree, match), { recursive: true, force: true });
        removed.push(match);
      }
    }
  }
  return removed;
};

/** Deletes each of `names` below every directory of `directories`. */
export const removeDirectories = (directories: readonly string[], names: readonly string[]): void => {
  for (const directory of directories) {
    for (const name of names) {
      const path = join(directory, name);
      if (existsSync(path)) {
        rmSync(path, { recursive: true, force: true });
      }
    }
  }
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
