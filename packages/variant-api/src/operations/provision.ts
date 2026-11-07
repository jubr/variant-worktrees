import { checkoutRoot, locateWorktree, repositoryDirectory } from "../locate.js";
import { miseBinaryFor } from "../mise.js";
import { installMiseInWorktree, parseMiseInstall } from "../mise-install.js";
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
  const mode = parseMiseInstall(options.miseInstall);
  const slug = resolveSlug(requestedSlug, context.cwd, config.variant.branchPrefixes, config.variant);
  const worktree =
    context.useWorktree && slug !== "main"
      ? ensureWorktree(
          slug,
          context.cwd,
          context.variantRoot,
          config.variant.prefix,
          config.variant,
          config.variant.main,
          options.from,
          { pullFf: options.pullFf, command: "provision", reprovision: options.reprovision },
        )
      : (locateWorktree(context, slug) ?? checkoutRoot(repositoryDirectory(context)));
  if (context.useWorktree && slug !== "main") {
    await installMiseInWorktree(worktree, mode, () => miseBinaryFor(context.config, context.miseBinPath));
  }
  const run = await prepareRun(context, slug, worktree);
  return { slug, ...(await runProvisioning(context, run, options)) };
};
