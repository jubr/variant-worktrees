import { realpathSync } from "node:fs";
import { basename, resolve } from "node:path";
import { findRemovable, isMerged } from "./cleanup.js";
import { runGit } from "./git.js";
import type { OperationContext } from "./operations/types.js";
import { variantConfigDir } from "./runtime-state.js";
import { worktreeEntries } from "./slug.js";

const realpathOrSelf = (path: string): string => {
  try {
    return realpathSync(path);
  } catch {
    return path;
  }
};

/** The git worktree `implode` would remove: registered with git and not the primary checkout. */
const removableWorktree = (context: OperationContext, worktree: string | undefined): string | undefined => {
  if (!worktree || !context.useWorktree) {
    return undefined;
  }
  try {
    const [primary, ...others] = worktreeEntries(context.cwd).map((entry) => realpathOrSelf(entry.path));
    const target = realpathOrSelf(worktree);
    return target !== primary && others.includes(target) ? worktree : undefined;
  } catch {
    return undefined;
  }
};

/** The paths, relative to `worktree`, that the `preRm` patterns would delete. */
const preRmMatches = (context: OperationContext, worktree: string, slug: string): string[] => {
  const { config } = context;
  const projectDir = variantConfigDir(config, worktree);
  const bases = [projectDir, ...Object.values(config.variant.watches).map((watch) => resolve(projectDir, watch.dir))];
  return findRemovable(worktree, bases, config.variant.implode.preRm, slug).map(({ path }) => path);
};

const underPrefix = (path: string, prefixes: readonly string[]): boolean =>
  prefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));

/**
 * Whether `implode` of `slug` without `force` would succeed. Nothing is deleted.
 * A variant git would not remove is clean. `main` is never clean.
 */
export const implodeWouldSucceed = (context: OperationContext, slug: string, worktree: string | undefined): boolean => {
  try {
    return decide(context, slug, worktree);
  } catch {
    return false;
  }
};

const decide = (context: OperationContext, slug: string, worktree: string | undefined): boolean => {
  if (slug === "main") {
    return false;
  }
  const removable = removableWorktree(context, worktree);
  if (!removable) {
    return true;
  }
  const { requireMerged, discard } = context.config.variant.implode;
  if (requireMerged && !isMerged(removable, context.config.variant.baseBranch).merged) {
    return false;
  }
  const status = runGit(removable, ["status", "--porcelain", "--untracked-files=all"]);
  if (!status.ok) {
    return false;
  }
  const doomed = preRmMatches(context, removable, slug);
  return status.stdout.split("\n").every((line) => {
    if (line === "") {
      return true;
    }
    const code = line.slice(0, 2);
    const path = line.slice(3).split(" -> ").at(-1) ?? "";
    if (code === "??") {
      return underPrefix(path, doomed);
    }
    // A tracked change stays, unless `discard` would put it back.
    return discard.includes(basename(path));
  });
};
