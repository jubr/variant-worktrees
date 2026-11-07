import { checkoutRoot, locateWorktree, repositoryDirectory } from "../locate.js";
import { type ProvisionOptions, type ProvisionResult, runProvisioning } from "../provisioning.js";
import { prepareRun, type VariantRun } from "../run-context.js";
import { createVariant } from "./create.js";
import { deprovisionPhase } from "./deprovision.js";
import { stopContainers, stopHostProcesses } from "./down.js";
import type { OperationContext } from "./types.js";

export interface PreparedVariant {
  run: VariantRun;
  provisioned: ProvisionResult;
}

/**
 * What `up` and `watch` do before they start watches: stop what the other mode (or an earlier run) left behind,
 * ensure the worktree, prepare the database target (the builtin provision step creates it; `main` is never touched),
 * assign the ports and provision. Stopping keeps the recorded runtime, so recorded ports are reused.
 */
export const prepareVariant = async (
  context: OperationContext,
  slug: string,
  mode: "up" | "watch",
  options: ProvisionOptions & { detach?: boolean } = {},
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
    worktree = earlier ?? repositoryDirectory(context);
  } else {
    worktree =
      (
        await createVariant(context, slug, {
          from: options.from,
          pullFf: options.pullFf,
          command: mode,
          detach: options.detach,
          reprovision: options.reprovision,
        })
      ).worktree ?? checkoutRoot(repositoryDirectory(context));
  }

  const run = await prepareRun(context, slug, worktree);
  if (mode === "watch" && options.reprovision && slug !== "main") {
    await deprovisionPhase(context, run, options.log);
  }
  return { run, provisioned: await runProvisioning(context, run, options) };
};
