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

/** Captures stderr. `runGit` drops it, which hides a failed fast-forward. */
const gitResult = (cwd: string, args: string[]): { code: number; stdout: string; stderr: string } => {
  try {
    return {
      code: 0,
      stdout: execFileSync("git", ["-C", cwd, ...args], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      }),
      stderr: "",
    };
  } catch (error) {
    const failed = error as { status?: number; stdout?: string; stderr?: string };
    return { code: failed.status ?? 1, stdout: failed.stdout ?? "", stderr: failed.stderr ?? "" };
  }
};

/** How to repeat a create that asked to fast-forward. `command` defaults to `create`. */
export interface PullFfOptions {
  pullFf?: boolean;
  command?: string;
  detach?: boolean;
  reprovision?: boolean;
}

const retryCommand = (slug: string, pull: PullFfOptions, from?: string): string => {
  const parts = ["variant", pull.command ?? "create", "--pull-ff"];
  if (from !== undefined) {
    parts.push("--from", from);
  }
  if (pull.detach === true) {
    parts.push("--detach");
  }
  if (pull.reprovision === true) {
    parts.push("--reprovision");
  }
  parts.push("--slug", slug);
  return parts.join(" ");
};

const pullError = (
  reason: string,
  slug: string,
  pull: PullFfOptions,
  from: string | undefined,
  detail: string,
): Error => new Error([reason, detail.trim(), retryCommand(slug, pull, from)].filter((line) => line !== "").join("\n"));

const localBranch = (repo: string, name: string): boolean =>
  gitResult(repo, ["show-ref", "--verify", "--quiet", `refs/heads/${name}`]).code === 0;

/** The branch a new worktree starts from, when that name is a local branch. A tag or commit is not. */
const startBranchName = (from: string | undefined, baseBranch: string, repo: string): string | undefined => {
  if (from === undefined) {
    return baseBranch;
  }
  return localBranch(repo, from) ? from : undefined;
};

const checkoutOf = (repo: string, branch: string): string | undefined =>
  worktreeEntries(repo).find((entry) => entry.branch === `refs/heads/${branch}`)?.path;

const restoreSnapshot = (checkout: string, head: string, snapshot: string, stashesBefore: number): void => {
  gitResult(checkout, ["reset", "--hard", head]);
  if (snapshot !== "") {
    gitResult(checkout, ["restore", "--source", snapshot, "--worktree", "--staged", ":/"]);
  }
  let listed = gitResult(checkout, ["stash", "list"])
    .stdout.split("\n")
    .filter((line) => line !== "");
  while (listed.length > stashesBefore) {
    gitResult(checkout, ["stash", "drop"]);
    listed = gitResult(checkout, ["stash", "list"])
      .stdout.split("\n")
      .filter((line) => line !== "");
  }
};

/**
 * Fast-forward `branch` before a new variant branch is created. A dry-run that predicts a conflict or any other
 * error leaves the branch and its checkout un-pulled. A pull that fails after that is restored to the same state.
 */
const fastForwardStart = (repo: string, branch: string, slug: string, pull: PullFfOptions, from?: string): void => {
  const remote = gitResult(repo, ["config", "--get", `branch.${branch}.remote`]);
  const merge = gitResult(repo, ["config", "--get", `branch.${branch}.merge`]);
  const remoteName = remote.stdout.trim();
  const upstreamBranch = merge.stdout.trim().replace(/^refs\/heads\//, "");
  if (remote.code !== 0 || merge.code !== 0 || remoteName === "" || upstreamBranch === "") {
    throw pullError(`${branch} has no upstream`, slug, pull, from, "");
  }
  const fetched = gitResult(repo, ["fetch", remoteName, upstreamBranch]);
  if (fetched.code !== 0) {
    throw pullError(`fetch of '${branch}' failed`, slug, pull, from, fetched.stderr);
  }
  const upstream = `${remoteName}/${upstreamBranch}`;
  if (gitResult(repo, ["merge-base", "--is-ancestor", branch, upstream]).code !== 0) {
    throw pullError(`${branch} has diverged from its upstream`, slug, pull, from, "");
  }
  const checkout = checkoutOf(repo, branch);
  if (checkout === undefined) {
    const updated = gitResult(repo, ["fetch", remoteName, `${upstreamBranch}:${branch}`]);
    if (updated.code !== 0) {
      throw pullError(`fast-forward of '${branch}' failed`, slug, pull, from, updated.stderr);
    }
    return;
  }
  const snapshot = gitResult(checkout, ["stash", "create", "--include-untracked"]).stdout.trim();
  if (snapshot !== "") {
    const merged = gitResult(checkout, ["merge-tree", "--write-tree", upstream, snapshot]);
    const incoming = gitResult(checkout, ["diff", "--name-only", branch, upstream])
      .stdout.split("\n")
      .filter((line) => line !== "");
    const untracked = new Set(
      gitResult(checkout, ["ls-files", "--others", "--exclude-standard"])
        .stdout.split("\n")
        .filter((line) => line !== ""),
    );
    const overwritten = incoming.filter((file) => untracked.has(file));
    if (merged.code !== 0 || overwritten.length > 0) {
      throw pullError(
        `local changes conflict with the incoming commits on '${branch}'`,
        slug,
        pull,
        from,
        merged.stderr || merged.stdout,
      );
    }
  }
  const head = gitResult(checkout, ["rev-parse", "HEAD"]).stdout.trim();
  const stashesBefore = gitResult(checkout, ["stash", "list"])
    .stdout.split("\n")
    .filter((line) => line !== "").length;
  const pulled = gitResult(checkout, ["pull", "--ff-only", "--autostash"]);
  if (pulled.code !== 0) {
    restoreSnapshot(checkout, head, snapshot, stashesBefore);
    throw pullError(`fast-forward of '${branch}' failed`, slug, pull, from, pulled.stderr);
  }
};

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

const gitCommonDir = (dir: string): string | undefined => {
  try {
    return realpathSync(runGit(dir, ["rev-parse", "--path-format=absolute", "--git-common-dir"]));
  } catch {
    return undefined;
  }
};

/** True when `cwd` is a worktree of the same repository as `repository`. */
const sharesRepository = (cwd: string, repository: string): boolean => {
  const left = gitCommonDir(cwd);
  const right = gitCommonDir(repository);
  return left !== undefined && left === right;
};

/**
 * Resolve `from` before `git worktree add`. Relative names such as `HEAD` use `cwd` when that directory is a
 * worktree of the repository, and `fallback` (`variant.main`) otherwise.
 */
const resolveCommit = (from: string, cwd: string, fallback: string): string => {
  const where = sharesRepository(cwd, fallback) ? cwd : fallback;
  try {
    return runGit(where, ["rev-parse", "--verify", "--end-of-options", `${from}^{commit}`]);
  } catch {
    throw new Error(`Cannot resolve '${from}'`);
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
  from?: string,
  pull?: PullFfOptions,
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

  const candidates = branches.branchPrefixes.map((entry) => `${entry}${normalized}`);
  const branch = candidates.find((candidate) => branchExists(primary, candidate)) ?? (candidates[0] as string);
  const reusingBranch = branchExists(primary, branch);
  if (pull?.pullFf === true && !reusingBranch) {
    const startBranch = startBranchName(from, branches.baseBranch, primary);
    if (startBranch !== undefined) {
      fastForwardStart(primary, startBranch, slug, pull, from);
    }
  }
  // Resolve before creating a directory so a bad commit-ish leaves nothing behind. An existing branch is checked out as it is.
  const start = reusingBranch || from === undefined ? branches.baseBranch : resolveCommit(from, cwd, main ?? primary);

  const root = resolve(variantRoot ?? detectVariantRoot(repository, main ?? detectVariantMain(repository)));
  mkdirSync(root, { recursive: true });
  const destination = join(root, `${prefix}${normalized}`);
  if (existsSync(destination)) {
    throw new Error(`Worktree path already exists but is not registered: ${destination}`);
  }

  const args = reusingBranch
    ? ["worktree", "add", destination, branch]
    : ["worktree", "add", "-b", branch, destination, start];
  runGit(primary, args);
  ignoreWorktrees(root, prefix, main ?? primary);
  return resolve(destination);
};
