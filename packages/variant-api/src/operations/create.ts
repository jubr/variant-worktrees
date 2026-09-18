import { resolveSlug } from "../slug.js";
import { readState, statePath, writeState } from "../state.js";
import type { VariantRecord } from "../types.js";
import { ensureWorktree } from "../worktree.js";
import type { OperationContext } from "./types.js";

export const createVariant = async (context: OperationContext, requestedSlug?: string): Promise<VariantRecord> => {
  const slug = resolveSlug(requestedSlug, context.cwd);
  const existing = readState(context.stateDir, slug);
  const worktree = context.useWorktree && slug !== "main" ? ensureWorktree(slug, context.cwd) : undefined;
  const target = slug === "main" ? (context.config.db.schema ?? "public") : context.adapter.target(slug);

  if (slug !== "main") {
    await context.adapter.create(slug);
  }
  if (existing) {
    return { ...existing, exists: true };
  }

  const state = {
    slug,
    target,
    dialect: context.adapter.dialect,
    statePath: statePath(context.stateDir, slug),
    worktree,
    createdAt: new Date().toISOString(),
  };
  const persistedPath = writeState(context.stateDir, state);
  return { ...state, statePath: persistedPath, exists: true };
};
