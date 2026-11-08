import { existsSync, realpathSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { LOCAL_FILENAME, STATE_FILE } from "variant-config";
import { isMerged, removeMatching, removeWorktree, restoreTracked, worktreeReport } from "../cleanup.js";
import { git, runGit } from "../git.js";
import { checkoutRoot, locateWorktree, repositoryDirectory } from "../locate.js";
import { logD as emit } from "../log.js";
import { logToStderr } from "../ready.js";
import { prepareRun } from "../run-context.js";
import { removeVariantRuntime, variantConfigDir } from "../runtime-state.js";
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
  const runtimeDir = worktree ? variantConfigDir(context.config, worktree) : undefined;
  const hadRuntime =
    runtimeDir !== undefined &&
    (existsSync(join(runtimeDir, STATE_FILE)) || existsSync(join(runtimeDir, LOCAL_FILENAME)));
  if (worktree) {
    removeVariantRuntime(context.config, worktree);
  }
  removeState(context.stateDir, slug);
  return removed || state !== undefined || hadRuntime;
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

const HEADS = "refs/heads/";

/** The branch checked out in `worktree`, when it is a local branch. A detached HEAD has none. */
const checkedOutBranch = (context: OperationContext, worktree: string): string | undefined => {
  const target = realpathOrSelf(worktree);
  const ref = worktreeEntries(repositoryDirectory(context)).find(
    (entry) => realpathOrSelf(entry.path) === target,
  )?.branch;
  return ref?.startsWith(HEADS) ? ref.slice(HEADS.length) : undefined;
};

/**
 * The first existing `<prefix><slug>` local branch, in `variant.branchPrefixes` order.
 * A directory that is not a git checkout has no branch to remove.
 */
const prefixedBranch = (context: OperationContext, slug: string): string | undefined => {
  let primary: string;
  try {
    primary = primaryWorktree(repositoryDirectory(context));
  } catch {
    return undefined;
  }
  return context.config.variant.branchPrefixes
    .map((prefix) => `${prefix}${slug}`)
    .find((name) => runGit(primary, ["show-ref", "--verify", "--quiet", `${HEADS}${name}`]).ok);
};

const assertBranchRm = (value: ImplodeOptions["branchRm"]): void => {
  if (value !== undefined && value !== "yes" && value !== "no") {
    throw new Error("branchRm must be one of yes, no");
  }
};

/**
 * Last step of implode. `no` keeps the branch. Omitted and `yes` delete it with `git branch -D` from the primary
 * checkout. The merge gate has already decided the work may go.
 */
const removeLocalBranch = (
  context: OperationContext,
  slug: string,
  branch: string | undefined,
  branchRm: ImplodeOptions["branchRm"],
): Pick<ImplodeResult, "branch" | "branchRemoved"> => {
  if (branchRm === "no") {
    emit(branch ? `kept branch ${branch}` : `no branch to remove for ${slug}`);
    return { ...(branch ? { branch } : {}), branchRemoved: false };
  }
  if (!branch) {
    emit(`no branch to remove for ${slug}`);
    return { branchRemoved: false };
  }
  git(primaryWorktree(repositoryDirectory(context)), ["branch", "-D", branch]);
  emit(`removed branch ${branch}`);
  return { branch, branchRemoved: true };
};

/**
 * Retires a variant: refuses `main`, and unless `force` or `implode.requireMerged: false` refuses work that is not
 * merged into the base branch. Then tears the variant down, cleans leftovers, prints what would be lost, removes
 * the worktree, and removes the local branch unless `branchRm` is `no`.
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
  assertBranchRm(options.branchRm);
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

  const branch = removable ? checkedOutBranch(context, removable) : present ? undefined : prefixedBranch(context, slug);
  const removed = await teardownVariant(context, slug, present ? located : undefined, options.log);
  if (!removable) {
    if (located !== undefined && !present) {
      git(primaryWorktree(repositoryDirectory(context)), ["worktree", "prune"]);
    }
    return finish({
      slug,
      removed,
      worktreeRemoved: false,
      ...removeLocalBranch(context, slug, branch, options.branchRm),
    });
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
  return finish({
    slug,
    removed,
    worktreeRemoved: true,
    worktree: removable,
    report,
    ...removeLocalBranch(context, slug, branch, options.branchRm),
  });
};

const finish = (result: ImplodeResult): ImplodeResult => {
  emit(`implode finished slug=${JSON.stringify(result.slug)}`);
  return result;
};
