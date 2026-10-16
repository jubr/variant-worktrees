import { existsSync, realpathSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  isMerged,
  removeDirectories,
  removeUntracked,
  removeWorktree,
  restoreTracked,
  worktreeReport,
} from "../cleanup.js";
import { locateWorktree } from "../locate.js";
import { logToStderr } from "../ready.js";
import { clearVariantRuntime, variantConfigDir } from "../runtime-state.js";
import { resolveSlug, worktreeEntries } from "../slug.js";
import { readState, removeState } from "../state.js";
import type { ImplodeOptions, ImplodeResult } from "../types.js";
import { primaryWorktree } from "../worktree.js";
import { stopContainers, stopHostProcesses } from "./down.js";
import type { OperationContext } from "./types.js";

const realpathOrSelf = (path: string): string => {
  try {
    return realpathSync(path);
  } catch {
    return path;
  }
};

/**
 * Removes what a variant owns, after the caller has decided that it may go: stops its runtime (as `down` does), drops
 * its database target, deletes its storage directory and clears its state and runtime section.
 */
const teardownVariant = async (
  context: OperationContext,
  slug: string,
  worktree: string | undefined,
  log?: (line: string) => void,
): Promise<boolean> => {
  if (worktree) {
    await stopHostProcesses(context, worktree);
  }
  stopContainers(context, slug, log);
  const state = readState(context.stateDir, slug);
  const removed = await context.adapter.destroy(slug);
  const storage = context.config.variant.storage;
  if (worktree && storage) {
    const directory = join(worktree, storage.dir);
    if (existsSync(directory)) {
      rmSync(directory, { recursive: true, force: true });
    }
  }
  if (worktree) {
    clearVariantRuntime(context.config, worktree);
  }
  removeState(context.stateDir, slug);
  return removed || state !== undefined;
};

/** The git worktree of a variant that may be removed: registered with git and not the primary checkout. */
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

/**
 * Retires a variant: refuses `main`, and unless `force` or `implode.requireMerged: false` refuses work that is not
 * merged into the base branch. Then tears the variant down, cleans leftovers, prints what would be lost and removes
 * the worktree. The branch stays.
 */
export const implodeVariant = async (
  context: OperationContext,
  requestedSlug?: string,
  options: ImplodeOptions = {},
): Promise<ImplodeResult> => {
  const { config } = context;
  const log = options.log ?? logToStderr;
  const slug = resolveSlug(requestedSlug, context.cwd, config.variant.branchPrefixes);
  if (slug === "main") {
    throw new Error("Refusing to implode main: it is the primary checkout");
  }
  const located = locateWorktree(context, slug);
  const removable = removableWorktree(context, located);
  const { requireMerged, preRm, restore, untracked, maxDiffLines } = config.variant.implode;

  if (removable && requireMerged && !options.force) {
    const { merged, into } = isMerged(removable, config.variant.baseBranch);
    if (!merged) {
      throw new Error(
        `Refusing to implode ${slug}: its HEAD is not merged into ${into}. Merge it, or use force to discard the work`,
      );
    }
  }

  const removed = await teardownVariant(context, slug, located, options.log);
  if (!removable) {
    return { slug, removed, worktreeRemoved: false };
  }

  removeUntracked(removable, untracked, slug);
  const instances = Object.values(config.variant.instances);
  removeDirectories(
    instances.length > 0
      ? instances.map((instance) => resolve(variantConfigDir(config, removable), instance.dir))
      : [removable],
    preRm,
  );
  const report = worktreeReport(removable, maxDiffLines);
  log(report);
  restoreTracked(removable, restore);
  removeWorktree(primaryWorktree(context.cwd), removable, options.force === true);
  return { slug, removed, worktreeRemoved: true, worktree: removable, report };
};
