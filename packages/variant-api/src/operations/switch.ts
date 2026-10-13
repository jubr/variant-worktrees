import { resolveSlug } from "../slug.js";
import { switchWorktree } from "../worktree.js";
import type { OperationContext } from "./types.js";

export const switchVariant = (
  context: OperationContext,
  requestedSlug?: string,
): { slug: string; worktree: string } => {
  const slug = resolveSlug(requestedSlug, context.cwd, context.config.variant.branchPrefixes);
  const worktree = switchWorktree(
    slug,
    context.cwd,
    context.variantRoot,
    context.config.variant.prefix,
    context.config.variant,
  );
  return { slug, worktree };
};
