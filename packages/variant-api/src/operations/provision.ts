import { type ProvisionOptions, type ProvisionResult, runProvisioning } from "../provisioning.js";
import { prepareRun } from "../run-context.js";
import { resolveSlug } from "../slug.js";
import { ensureWorktree } from "../worktree.js";
import type { OperationContext } from "./types.js";

export const provisionVariant = async (
  context: OperationContext,
  requestedSlug?: string,
  options: ProvisionOptions = {},
): Promise<{ slug: string } & ProvisionResult> => {
  const { config } = context;
  const slug = resolveSlug(requestedSlug, context.cwd, config.variant.branchPrefixes);
  const worktree =
    context.useWorktree && slug !== "main"
      ? ensureWorktree(slug, context.cwd, context.variantRoot, config.variant.prefix, config.variant)
      : context.cwd;
  const run = await prepareRun(context, slug, worktree);
  return { slug, ...runProvisioning(context, run, options) };
};
