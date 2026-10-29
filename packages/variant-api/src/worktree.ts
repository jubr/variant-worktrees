import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { DEFAULT_PREFIX, detectVariantRoot } from "variant-config";
import { DEFAULT_BRANCH_PREFIXES, gitRoot, sanitizeSlug, worktreeEntries } from "./slug.js";

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

/** Where new variant branches start and how they are named: `variant.baseBranch` and `variant.branchPrefixes`. */
export interface BranchSettings {
  baseBranch: string;
  branchPrefixes: readonly string[];
}

export const DEFAULT_BRANCH_SETTINGS: BranchSettings = {
  baseBranch: "main",
  branchPrefixes: DEFAULT_BRANCH_PREFIXES,
};

const worktreeForBranch = (slug: string, cwd: string, branchPrefixes: readonly string[]): string | undefined =>
  worktreeEntries(cwd).find((entry) => entry.branch && sanitizeSlug(entry.branch, branchPrefixes) === slug)?.path;

export const primaryWorktree = (cwd = process.cwd()): string => {
  const primary = worktreeEntries(cwd)[0]?.path;
  return resolve(primary ?? gitRoot(cwd));
};

export const ensureWorktree = (
  slug: string,
  cwd = process.cwd(),
  variantRoot?: string,
  prefix: string = DEFAULT_PREFIX,
  branches: BranchSettings = DEFAULT_BRANCH_SETTINGS,
): string => {
  const normalized = sanitizeSlug(slug, branches.branchPrefixes);
  const primary = primaryWorktree(cwd);
  if (normalized === "main") {
    return primary;
  }

  const existing = worktreeForBranch(normalized, cwd, branches.branchPrefixes);
  if (existing) {
    return resolve(existing);
  }

  const root = resolve(variantRoot ?? detectVariantRoot(cwd));
  mkdirSync(root, { recursive: true });
  const destination = join(root, `${prefix}${normalized}`);
  if (existsSync(destination)) {
    throw new Error(`Worktree path already exists but is not registered: ${destination}`);
  }

  const candidates = branches.branchPrefixes.map((entry) => `${entry}${normalized}`);
  const branch = candidates.find((candidate) => branchExists(primary, candidate)) ?? (candidates[0] as string);
  const args = branchExists(primary, branch)
    ? ["worktree", "add", destination, branch]
    : ["worktree", "add", "-b", branch, destination, branches.baseBranch];
  runGit(primary, args);
  return resolve(destination);
};
