import { realpathSync } from "node:fs";
import { basename, join, relative, resolve } from "node:path";
import { globSync } from "tinyglobby";
import { isMerged } from "./cleanup.js";
import { git, runGit } from "./git.js";
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

/** Directories `preRm` deletes before the worktree goes, relative to `worktree`. */
const preRmPrefixes = (context: OperationContext, worktree: string): string[] => {
  const { preRm, instances } = {
    preRm: context.config.variant.implode.preRm,
    instances: Object.values(context.config.variant.instances),
  };
  const bases =
    instances.length > 0
      ? instances.map((instance) => resolve(variantConfigDir(context.config, worktree), instance.dir))
      : [worktree];
  return bases.flatMap((base) => preRm.map((name) => relative(worktree, join(base, name))));
};

/** Untracked paths `variant.implode.untracked` would delete. */
const untrackedMatches = (worktree: string, patterns: readonly string[], slug: string): Set<string> => {
  const matches = new Set<string>();
  for (const pattern of patterns) {
    for (const match of globSync(pattern.replaceAll("{{slug}}", slug), {
      cwd: worktree,
      dot: true,
      onlyFiles: true,
      expandDirectories: false,
      followSymbolicLinks: false,
    })) {
      matches.add(match);
    }
  }
  return matches;
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
  const { requireMerged, restore, untracked } = context.config.variant.implode;
  if (requireMerged && !isMerged(removable, context.config.variant.baseBranch).merged) {
    return false;
  }
  const status = runGit(removable, ["status", "--porcelain", "--untracked-files=all"]);
  if (!status.ok) {
    return false;
  }
  const prefixes = preRmPrefixes(context, removable);
  const forgotten = untrackedMatches(removable, untracked, slug);
  const trackedInPreRm = git(removable, ["ls-files"])
    .split("\n")
    .filter((path) => path !== "" && underPrefix(path, prefixes));
  if (trackedInPreRm.some((path) => !restore.includes(basename(path)))) {
    return false;
  }
  return status.stdout.split("\n").every((line) => {
    if (line === "") {
      return true;
    }
    const code = line.slice(0, 2);
    const path = line.slice(3).split(" -> ").at(-1) ?? "";
    const removedAhead = underPrefix(path, prefixes);
    if (code === "??") {
      return removedAhead || forgotten.has(path);
    }
    // A tracked change inside preRm becomes a deletion implode would not put back, unless restore would.
    return restore.includes(basename(path));
  });
};
