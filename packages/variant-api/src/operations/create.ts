import { formatLocalStamp, type Runtime, readRuntime, writeRuntime } from "variant-config";
import { implodeWouldSucceed } from "../implode-clean.js";
import { variantConfigDir } from "../runtime-state.js";
import { resolveSlug } from "../slug.js";
import { readState, statePath, writeState } from "../state.js";
import type { VariantRecord } from "../types.js";
import { ensureWorktree } from "../worktree.js";
import type { OperationContext } from "./types.js";

/** Writes `runtime.createdAt` once. A value already in the file, and any other top-level keys, stay. */
const rememberCreatedAt = (context: OperationContext, directory: string): void => {
  let existing: Runtime | undefined;
  try {
    existing = readRuntime(directory, {});
  } catch {
    existing = undefined;
  }
  if (existing?.createdAt) {
    return;
  }
  writeRuntime(directory, { ...existing, createdAt: formatLocalStamp(context.now?.() ?? new Date()) });
};

export const createVariant = async (context: OperationContext, requestedSlug?: string): Promise<VariantRecord> => {
  const slug = resolveSlug(requestedSlug, context.cwd, context.config.variant.branchPrefixes);
  const existing = readState(context.stateDir, slug);
  const worktree =
    context.useWorktree && slug !== "main"
      ? ensureWorktree(
          slug,
          context.cwd,
          context.variantRoot,
          context.config.variant.prefix,
          context.config.variant,
          context.config.variant.main,
        )
      : undefined;
  const target = slug === "main" ? (context.config.db.schema ?? "public") : context.adapter.target(slug);

  if (slug !== "main") {
    await context.adapter.create(slug);
  }
  const state = existing ?? {
    slug,
    target,
    dialect: context.adapter.dialect,
    statePath: statePath(context.stateDir, slug),
    worktree,
    createdAt: new Date().toISOString(),
  };
  const persistedPath = existing ? state.statePath : writeState(context.stateDir, state);
  const variantDirectory =
    slug === "main"
      ? variantConfigDir(context.config, context.config.variant.main)
      : worktree
        ? variantConfigDir(context.config, worktree)
        : undefined;
  if (variantDirectory !== undefined) {
    rememberCreatedAt(context, variantDirectory);
  }
  return {
    ...state,
    statePath: persistedPath,
    exists: true,
    implodeClean: implodeWouldSucceed(context, slug, state.worktree),
  };
};
