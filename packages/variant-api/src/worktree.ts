import { execFileSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readFileSync, realpathSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";
import { DEFAULT_PREFIX, detectVariantMain, detectVariantRoot } from "variant-config";
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

const realpathOrResolve = (path: string): string => {
  try {
    return realpathSync(path);
  } catch {
    return resolve(path);
  }
};

const isInside = (directory: string, path: string): boolean => {
  const relation = relative(directory, path);
  return relation === "" || (!relation.startsWith("..") && !isAbsolute(relation));
};

/** Whether a `.gitignore` line already ignores every `<prefix>*` directory: `_v-*`, `/_v-*`, each with an optional `/`. */
const ignoresWorktrees = (content: string, prefix: string): boolean =>
  content.split(/\r?\n/).some((line) => line.trim().replace(/^\//, "").replace(/\/$/, "") === `${prefix}*`);

/**
 * A worktree inside the main tree shows up as untracked: add `<prefix>*` to the `.gitignore` of the directory that
 * holds it. Only an existing file is changed, and only when the entry is missing.
 */
const ignoreWorktrees = (root: string, prefix: string, main: string): void => {
  const file = join(root, ".gitignore");
  if (!existsSync(file) || !isInside(realpathOrResolve(main), realpathOrResolve(root))) {
    return;
  }
  const content = readFileSync(file, "utf8");
  if (!ignoresWorktrees(content, prefix)) {
    appendFileSync(file, `${content === "" || content.endsWith("\n") ? "" : "\n"}${prefix}*\n`);
  }
};

/** The directory to ask git in: the main tree when it is a repository, else the working directory. */
const gitDirectory = (cwd: string, main?: string): string => {
  if (main) {
    try {
      primaryWorktree(main);
      return main;
    } catch {
      // not a repository: fall back to the working directory
    }
  }
  return cwd;
};

export const ensureWorktree = (
  slug: string,
  cwd = process.cwd(),
  variantRoot?: string,
  prefix: string = DEFAULT_PREFIX,
  branches: BranchSettings = DEFAULT_BRANCH_SETTINGS,
  main?: string,
): string => {
  const normalized = sanitizeSlug(slug, branches.branchPrefixes);
  const repository = gitDirectory(cwd, main);
  const primary = primaryWorktree(repository);
  if (normalized === "main") {
    return primary;
  }

  const existing = worktreeForBranch(normalized, repository, branches.branchPrefixes);
  if (existing) {
    return resolve(existing);
  }

  const root = resolve(variantRoot ?? detectVariantRoot(repository, main ?? detectVariantMain(repository)));
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
  ignoreWorktrees(root, prefix, main ?? primary);
  return resolve(destination);
};
