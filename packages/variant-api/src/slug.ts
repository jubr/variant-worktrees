import { execFileSync } from "node:child_process";
import { realpathSync } from "node:fs";
import { resolve } from "node:path";

interface WorktreeEntry {
  path: string;
  branch?: string;
}

export const sanitizeSlug = (value: string): string => {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/^refs\/heads\//, "")
    .replace(/^(feat|feature|fix)\//, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!slug) {
    throw new Error("Slug must contain at least one letter or number");
  }
  return slug;
};

const git = (cwd: string, args: string[]): string => {
  try {
    return execFileSync("git", ["-C", cwd, ...args], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    throw new Error(`Unable to inspect git worktree from ${cwd}`);
  }
};

export const worktreeEntries = (cwd = process.cwd()): WorktreeEntry[] => {
  const output = git(cwd, ["worktree", "list", "--porcelain"]);
  const entries: WorktreeEntry[] = [];
  let current: WorktreeEntry | undefined;
  for (const line of output.split("\n")) {
    if (line.startsWith("worktree ")) {
      if (current) {
        entries.push(current);
      }
      current = { path: line.slice("worktree ".length) };
    } else if (line.startsWith("branch ") && current) {
      current.branch = line.slice("branch ".length);
    }
  }
  if (current) {
    entries.push(current);
  }
  return entries;
};

export const gitRoot = (cwd = process.cwd()): string => resolve(git(cwd, ["rev-parse", "--show-toplevel"]));

export const resolveSlug = (explicitSlug?: string, cwd = process.cwd()): string => {
  if (explicitSlug !== undefined) {
    return sanitizeSlug(explicitSlug);
  }

  const root = realpathSync(gitRoot(cwd));
  const entries = worktreeEntries(cwd);
  const primary = entries[0];
  if (primary && realpathSync(primary.path) === root) {
    return "main";
  }

  const current = entries.find((entry) => {
    try {
      return realpathSync(entry.path) === root;
    } catch {
      return false;
    }
  });
  const branch = current?.branch ?? "";
  if (!branch) {
    throw new Error("Unable to derive variant slug from current git worktree; pass -s/--slug");
  }
  return sanitizeSlug(branch);
};
