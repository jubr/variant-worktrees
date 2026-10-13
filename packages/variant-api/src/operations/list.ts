import { basename } from "node:path";
import { type DiscoveredRuntime, readRuntimes } from "variant-config";
import { isProcessAlive } from "../runtime-state.js";
import { readState, stateSlugs } from "../state.js";
import type { InstanceFacts, VariantRecord } from "../types.js";
import { primaryWorktree } from "../worktree.js";
import type { OperationContext } from "./types.js";

const slugFromTarget = (target: string, dialect: string): string => {
  if (dialect === "sqlite") {
    return target;
  }
  return target.replace(/^v_/, "").replaceAll("_", "-");
};

const mainWorktree = (cwd: string): string => {
  try {
    return primaryWorktree(cwd);
  } catch {
    return cwd;
  }
};

/** The runtime state of every variant: `<root>/<prefix>*` worktrees and the main checkout, keyed by slug. */
const runtimeBySlug = (context: OperationContext): Map<string, DiscoveredRuntime> => {
  const { prefix, root } = context.config.variant;
  const main = mainWorktree(context.cwd);
  const { states } = readRuntimes({ root, prefix, main });
  return new Map(
    states.map((state) => {
      const name = basename(state.dir);
      const derived = state.dir !== main && name.startsWith(prefix) ? name.slice(prefix.length) : "main";
      return [state.runtime.slug ?? derived, state] as const;
    }),
  );
};

const instanceFacts = (runtime: DiscoveredRuntime["runtime"]): Record<string, InstanceFacts> =>
  Object.fromEntries(
    Object.entries(runtime.instances ?? {}).map(([key, instance]) => [
      key,
      { ...instance, ...(instance.pid === undefined ? {} : { alive: isProcessAlive(instance.pid) }) },
    ]),
  );

export const listVariants = async (context: OperationContext): Promise<VariantRecord[]> => {
  const { dialect } = context.adapter;
  const databaseSlugs = new Map(
    (await context.adapter.list()).map((target) => [slugFromTarget(target, dialect), target] as const),
  );
  const runtimes = runtimeBySlug(context);
  const slugs = new Set([...stateSlugs(context.stateDir), ...databaseSlugs.keys(), ...runtimes.keys()]);
  return [...slugs].sort().map((slug) => {
    const state = readState(context.stateDir, slug);
    const found = runtimes.get(slug);
    const instances = found ? instanceFacts(found.runtime) : undefined;
    const url = Object.values(instances ?? {}).find((instance) => instance.url !== undefined)?.url;
    const runtimeTarget = found?.runtime.db?.schema ?? found?.runtime.db?.filename;
    return {
      slug,
      target: state?.target ?? runtimeTarget ?? (databaseSlugs.has(slug) ? context.adapter.target(slug) : ""),
      dialect: state?.dialect ?? context.adapter.dialect,
      statePath: state?.statePath ?? "",
      worktree: state?.worktree ?? found?.runtime.dir ?? found?.dir,
      createdAt: state?.createdAt ?? "",
      exists: true,
      ...(found?.runtime.mode ? { mode: found.runtime.mode } : {}),
      ...(url ? { url } : {}),
      ...(instances && Object.keys(instances).length > 0 ? { instances } : {}),
    };
  });
};
