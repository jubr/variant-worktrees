import { resolveSlug } from "../slug.js";
import { readState, removeState } from "../state.js";
import type { OperationContext } from "./types.js";

export const destroyVariant = async (
  context: OperationContext,
  requestedSlug?: string,
): Promise<{ slug: string; removed: boolean }> => {
  const slug = resolveSlug(requestedSlug, context.cwd);
  if (slug === "main") {
    throw new Error("Refusing to destroy main variant");
  }
  const state = readState(context.stateDir, slug);
  const removed = await context.adapter.destroy(slug);
  removeState(context.stateDir, slug);
  return { slug, removed: removed || state !== undefined };
};
