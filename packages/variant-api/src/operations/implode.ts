import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { locateWorktree } from "../locate.js";
import { clearVariantRuntime } from "../runtime-state.js";
import { resolveSlug } from "../slug.js";
import { readState, removeState } from "../state.js";
import { stopContainers, stopHostProcesses } from "./down.js";
import type { OperationContext } from "./types.js";

/**
 * Removes what a variant owns, after the caller has decided that it may go: stops its runtime (as `down` does), drops
 * its database target, deletes its storage directory and clears its state and runtime section.
 */
const teardownVariant = async (
  context: OperationContext,
  slug: string,
  worktree: string | undefined,
): Promise<boolean> => {
  if (worktree) {
    await stopHostProcesses(context, worktree);
  }
  stopContainers(context, slug);
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

export const implodeVariant = async (
  context: OperationContext,
  requestedSlug?: string,
): Promise<{ slug: string; removed: boolean }> => {
  const slug = resolveSlug(requestedSlug, context.cwd, context.config.variant.branchPrefixes);
  if (slug === "main") {
    throw new Error("Refusing to implode main: it is the primary checkout");
  }
  const removed = await teardownVariant(context, slug, locateWorktree(context, slug));
  return { slug, removed };
};
