import { existsSync, realpathSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { isMerged, removeMatching, removeWorktree, restoreTracked, worktreeReport } from "../cleanup.js";
import { git } from "../git.js";
import { checkoutRoot, locateWorktree, repositoryDirectory } from "../locate.js";
import { logToStderr } from "../ready.js";
import { prepareRun } from "../run-context.js";
import { clearVariantRuntime, variantConfigDir } from "../runtime-state.js";
import { resolveSlug, worktreeEntries } from "../slug.js";
import { readState, removeState } from "../state.js";
import type { ImplodeOptions, ImplodeResult } from "../types.js";
import { primaryWorktree } from "../worktree.js";
import { deprovisionPhase } from "./deprovision.js";
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
  const run = await prepareRun(context, slug, worktree ?? checkoutRoot(repositoryDirectory(context)));
  const phase = await deprovisionPhase(context, run, log);
  const removed = phase.dropped.length > 0;
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
    const [primary, ...others] = worktreeEntries(repositoryDirectory(context)).map((entry) =>
      realpathOrSelf(entry.path),
    );
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
  const slug = resolveSlug(requestedSlug, context.cwd, config.variant.branchPrefixes, config.variant);
  if (slug === "main") {
    throw new Error("Refusing to implode main: it is the primary checkout");
  }
  const located = locateWorktree(context, slug);
  const present = located !== undefined && existsSync(located);
  const removable = present ? removableWorktree(context, located) : undefined;
  const { requireMerged, preRm, discard, maxDiffLines } = config.variant.implode;

  if (removable && requireMerged && !options.force) {
    const { merged, into } = isMerged(removable, config.variant.baseBranch);
    if (!merged) {
      throw new Error(
        `Refusing to implode ${slug}: its HEAD is not merged into ${into}. Merge it, or use force to discard the work`,
      );
    }
  }

  const removed = await teardownVariant(context, slug, present ? located : undefined, options.log);
  if (!removable) {
    if (located !== undefined && !present) {
      git(primaryWorktree(repositoryDirectory(context)), ["worktree", "prune"]);
    }
    return { slug, removed, worktreeRemoved: false };
  }

  const projectDir = variantConfigDir(config, removable);
  removeMatching(
    removable,
    [projectDir, ...Object.values(config.variant.watches).map((watch) => resolve(projectDir, watch.dir))],
    preRm,
    slug,
    config.environment,
  );
  const report = worktreeReport(removable, maxDiffLines);
  log(report);
  restoreTracked(removable, discard);
  removeWorktree(primaryWorktree(repositoryDirectory(context)), removable, options.force === true);
  return { slug, removed, worktreeRemoved: true, worktree: removable, report };
};
