import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import type { OperationContext } from "./operations/types.js";
import { sanitizeSlug, worktreeEntries } from "./slug.js";
import { primaryWorktree } from "./worktree.js";

/**
 * The directory of the variant's worktree if it has one: the primary checkout for `main`, the current directory when
 * worktrees are not used, otherwise the worktree git knows for the slug or the `<prefix><slug>` directory below the root.
 */
export const locateWorktree = (context: OperationContext, slug: string): string | undefined => {
  if (slug === "main") {
    try {
      return primaryWorktree(context.cwd);
    } catch {
      return context.cwd;
    }
  }
  if (!context.useWorktree) {
    return context.cwd;
  }
  const { branchPrefixes, prefix } = context.config.variant;
  try {
    const found = worktreeEntries(context.cwd).find(
      (entry) => entry.branch && sanitizeSlug(entry.branch, branchPrefixes) === slug,
    );
    if (found) {
      return resolve(found.path);
    }
  } catch {
    // not a git repository: fall through to the conventional directory
  }
  const conventional = join(context.variantRoot, `${prefix}${slug}`);
  return existsSync(conventional) ? conventional : undefined;
};
