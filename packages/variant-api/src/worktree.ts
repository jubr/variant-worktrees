import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { DEFAULT_WORKTREE_PREFIX, detectVariantRoot } from "variant-config";
import { gitRoot, sanitizeSlug, worktreeEntries } from "./slug.js";

const runGit = (cwd: string, args: string[]): string =>
  execFileSync("git", ["-C", cwd, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();

const branchExists = (repo: string, branch: string): boolean => {
  try {
    runGit(repo, ["show-ref", "--verify", "--quiet", `refs/heads/${branch}`]);
    return true;
  } catch {
    return false;
  }
};

const worktreeForBranch = (slug: string, cwd: string): string | undefined =>
  worktreeEntries(cwd).find((entry) => entry.branch && sanitizeSlug(entry.branch) === slug)?.path;

export const primaryWorktree = (cwd = process.cwd()): string => {
  const primary = worktreeEntries(cwd)[0]?.path;
  return resolve(primary ?? gitRoot(cwd));
};

export const ensureWorktree = (
  slug: string,
  cwd = process.cwd(),
  variantRoot?: string,
  prefix: string = DEFAULT_WORKTREE_PREFIX,
): string => {
  const normalized = sanitizeSlug(slug);
  const primary = primaryWorktree(cwd);
  if (normalized === "main") {
    return primary;
  }

  const existing = worktreeForBranch(normalized, cwd);
  if (existing) {
    return resolve(existing);
  }

  const root = resolve(variantRoot ?? detectVariantRoot(cwd));
  mkdirSync(root, { recursive: true });
  const destination = join(root, `${prefix}-${normalized}`);
  if (existsSync(destination)) {
    throw new Error(`Worktree path already exists but is not registered: ${destination}`);
  }

  const branch = branchExists(primary, `feat/${normalized}`)
    ? `feat/${normalized}`
    : branchExists(primary, `fix/${normalized}`)
      ? `fix/${normalized}`
      : `feat/${normalized}`;
  const args = branchExists(primary, branch)
    ? ["worktree", "add", destination, branch]
    : ["worktree", "add", "-b", branch, destination, "main"];
  runGit(primary, args);
  return resolve(destination);
};

export const switchWorktree = (slug: string, cwd = process.cwd(), variantRoot?: string, prefix?: string): string => {
  const path = ensureWorktree(slug, cwd, variantRoot, prefix);
  process.chdir(path);
  return path;
};
