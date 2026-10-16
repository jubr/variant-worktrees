import { checkoutRoot, locateWorktree } from "../locate.js";
import { type ProvisionOptions, type ProvisionResult, runProvisioning } from "../provisioning.js";
import { prepareRun, type VariantRun } from "../run-context.js";
import { createVariant } from "./create.js";
import { stopContainers, stopHostProcesses } from "./down.js";
import type { OperationContext } from "./types.js";

export interface PreparedVariant {
  run: VariantRun;
  provisioned: ProvisionResult;
}

/**
 * What `up` and `watch` do before they start instances: stop what the other mode (or an earlier run) left behind,
 * ensure the worktree, prepare the database target (`up` recreates it clean, `watch` keeps it; `main` is never touched),
 * assign the ports and provision. Stopping keeps the recorded runtime, so recorded ports are reused.
 */
export const prepareVariant = async (
  context: OperationContext,
  slug: string,
  mode: "up" | "watch",
  options: ProvisionOptions = {},
): Promise<PreparedVariant> => {
  const earlier = locateWorktree(context, slug);
  if (earlier) {
    await stopHostProcesses(context, earlier);
  }
  if (mode === "watch") {
    stopContainers(context, slug, options.log);
  }

  let worktree: string;
  if (slug === "main") {
    worktree = earlier ?? context.cwd;
  } else {
    if (mode === "up") {
      await context.adapter.destroy(slug);
    }
    worktree = (await createVariant(context, slug)).worktree ?? checkoutRoot(context.cwd);
  }

  const run = await prepareRun(context, slug, worktree);
  return { run, provisioned: runProvisioning(context, run, options) };
};
