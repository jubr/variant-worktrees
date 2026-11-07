import { join } from "node:path";
import { formatLocalStamp, type Runtime, readRuntime, STATE_FILE, writeRuntime } from "variant-config";
import { implodeWouldSucceed } from "../implode-clean.js";
import { miseBinaryFor } from "../mise.js";
import { installMiseInWorktree, parseMiseInstall } from "../mise-install.js";
import { variantConfigDir } from "../runtime-state.js";
import { resolveSlug } from "../slug.js";
import { readState } from "../state.js";
import type { VariantRecord } from "../types.js";
import { ensureWorktree } from "../worktree.js";
import type { OperationContext } from "./types.js";

/** The adapter reports a dialect name. `state.yaml` stores the three known ones. */
const recordedDialect = (dialect: string): "postgres" | "mysql" | "sqlite" => {
  if (dialect === "postgres" || dialect === "mysql" || dialect === "sqlite") {
    return dialect;
  }
  throw new Error(`unknown dialect ${dialect}`);
};

/** Writes identity into `state.yaml` once `createdAt` is missing. An existing stamp stays. */
const rememberCreated = (context: OperationContext, directory: string, slug: string, target: string): void => {
  let existing: Runtime | undefined;
  try {
    existing = readRuntime(directory, {});
  } catch {
    existing = undefined;
  }
  if (existing?.createdAt) {
    return;
  }
  const dialect = recordedDialect(context.adapter.dialect);
  writeRuntime(directory, {
    ...existing,
    slug: existing?.slug ?? slug,
    dir: existing?.dir ?? directory,
    db: existing?.db ?? (dialect === "sqlite" ? { dialect, filename: target } : { dialect, schema: target }),
    createdAt: formatLocalStamp(context.now?.() ?? new Date()),
  });
};

export const createVariant = async (
  context: OperationContext,
  requestedSlug?: string,
  options?: {
    from?: string;
    pullFf?: boolean;
    command?: string;
    detach?: boolean;
    reprovision?: boolean;
    miseInstall?: "bg" | "sync" | "no";
  },
): Promise<VariantRecord> => {
  const command = options?.command ?? "create";
  const installs = command === "create" || command === "provision" || command === "watch";
  const mode = installs ? parseMiseInstall(options?.miseInstall) : "no";
  await context.adapter.assertReachable?.();
  const slug = resolveSlug(requestedSlug, context.cwd, context.config.variant.branchPrefixes, context.config.variant);
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
          options?.from,
          {
            pullFf: options?.pullFf,
            command: options?.command ?? "create",
            detach: options?.detach,
            reprovision: options?.reprovision,
          },
        )
      : undefined;
  const target = slug === "main" ? (context.config.db.schema ?? "public") : context.adapter.target(slug);
  // AIDEV-NOTE: the schema or database file appears at provision, which watch and up imply. create only records the target.
  const variantDirectory =
    slug === "main"
      ? variantConfigDir(context.config, context.config.variant.main)
      : worktree
        ? variantConfigDir(context.config, worktree)
        : undefined;
  if (variantDirectory !== undefined) {
    rememberCreated(context, variantDirectory, slug, target);
  }
  await installMiseInWorktree(worktree, mode, () => miseBinaryFor(context.config, context.miseBinPath), command, slug);
  const state = existing ?? {
    slug,
    target,
    dialect: context.adapter.dialect,
    statePath: variantDirectory === undefined ? "" : join(variantDirectory, STATE_FILE),
    worktree,
    createdAt: "",
  };
  return {
    ...state,
    statePath: state.statePath,
    exists: true,
    implodeClean: implodeWouldSucceed(context, slug, state.worktree),
  };
};
