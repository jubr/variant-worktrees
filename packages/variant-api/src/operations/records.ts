import { existsSync, readdirSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import {
  type DiscoveredRuntime,
  LOCAL_FILENAME,
  type ResolvedConfig,
  readRuntimes,
  UI_INSTANCE_KEY,
} from "variant-config";
import { implodeWouldSucceed } from "../implode-clean.js";
import { redacted } from "../redact.js";
import { isProcessAlive } from "../runtime-state.js";
import { readState, stateSlugs } from "../state.js";
import type { InstanceFacts, RuntimeStatus, VariantRecord } from "../types.js";
import { processUptimeSeconds } from "../uptime.js";
import type { OperationContext } from "./types.js";

const slugFromTarget = (target: string, dialect: string): string => {
  if (dialect === "sqlite") {
    return target;
  }
  return target.replace(/^v_/, "").replaceAll("_", "-");
};

/** The directories whose `variants.local.yaml` makes up the runtime state: the variant worktrees and the main checkout. */
export const runtimeDirectories = (config: ResolvedConfig): { root: string; prefix: string; directories: string[] } => {
  const { prefix, root, main } = config.variant;
  const worktrees = existsSync(root)
    ? readdirSync(root, { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && entry.name.startsWith(prefix))
        .map((entry) => join(root, entry.name))
    : [];
  return { root, prefix, directories: [...new Set([...worktrees, main])] };
};

/** The runtime state of every variant: `<root>/<prefix>*` worktrees and the main checkout, keyed by slug. */
const runtimeBySlug = (context: OperationContext): Map<string, DiscoveredRuntime> => {
  const { prefix, root, main } = context.config.variant;
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
    Object.entries(runtime.instances ?? {}).map(([key, instance]) => {
      const alive = instance.pid === undefined ? undefined : isProcessAlive(instance.pid);
      const uptimeSeconds = alive && instance.pid !== undefined ? processUptimeSeconds(instance.pid) : undefined;
      return [
        key,
        {
          ...instance,
          ...(alive === undefined ? {} : { alive }),
          ...(uptimeSeconds === undefined ? {} : { uptimeSeconds }),
        },
      ];
    }),
  );

/** The instances that belong to the variant's own run: not the UI server, which `main` only hosts. */
const ownInstances = (instances: Record<string, InstanceFacts>): InstanceFacts[] =>
  Object.entries(instances)
    .filter(([key]) => key !== UI_INSTANCE_KEY)
    .map(([, instance]) => instance);

/** Birth and modification times of one path, or nothing when it cannot be read. */
const momentOf = (path: string): { birth: number; mtime: number } | undefined => {
  try {
    const stat = statSync(path);
    return { birth: stat.birthtimeMs, mtime: stat.mtimeMs };
  } catch {
    return undefined;
  }
};

/**
 * `createdMs` is the earlier birth time of the variant directory and its `variants.local.yaml`.
 * `changedMs` is the later modification time of those paths. A missing path is skipped.
 */
const timesOf = (
  directory: string | undefined,
  yaml: string | undefined,
): { createdMs?: number; changedMs?: number } => {
  const moments = [directory, yaml].flatMap((path) => {
    if (path === undefined || !existsSync(path)) {
      return [];
    }
    const moment = momentOf(path);
    return moment === undefined ? [] : [moment];
  });
  if (moments.length === 0) {
    return {};
  }
  return {
    createdMs: Math.min(...moments.map((moment) => moment.birth)),
    changedMs: Math.max(...moments.map((moment) => moment.mtime)),
  };
};

/** The longest uptime among the instances that have one. */
const longestUptime = (instances: Record<string, InstanceFacts>): number | undefined => {
  const all = ownInstances(instances).flatMap(({ uptimeSeconds }) =>
    uptimeSeconds === undefined ? [] : [uptimeSeconds],
  );
  return all.length === 0 ? undefined : Math.max(...all);
};

const runtimeStatus = (found: DiscoveredRuntime, instances: Record<string, InstanceFacts>): RuntimeStatus => {
  const { slug, mode, dir, log, db, instances: _recorded } = found.runtime;
  return {
    file: join(found.dir, LOCAL_FILENAME),
    ...(slug ? { slug } : {}),
    ...(mode ? { mode } : {}),
    ...(dir ? { dir } : {}),
    ...(log ? { log } : {}),
    ...(db ? { db: redacted(db) as RuntimeStatus["db"] } : {}),
    ...(Object.keys(instances).length > 0 ? { instances } : {}),
  };
};

export interface CollectOptions {
  /** Attach `runtime` to every record. */
  verbose?: boolean;
  /** Only this variant. */
  slug?: string;
}

/**
 * The records of the known variants, sorted by slug: those with a state file, a database target or a runtime state.
 * `list` and `status` both build their records here, so a record of `list` with `verbose` equals the one of `status`.
 */
export const collectRecords = async (
  context: OperationContext,
  options: CollectOptions = {},
): Promise<VariantRecord[]> => {
  const { dialect } = context.adapter;
  const databaseSlugs = new Map(
    (await context.adapter.list()).map((target) => [slugFromTarget(target, dialect), target] as const),
  );
  const runtimes = runtimeBySlug(context);
  const known = new Set([...stateSlugs(context.stateDir), ...databaseSlugs.keys(), ...runtimes.keys()]);
  const slugs = [...known].filter((slug) => options.slug === undefined || slug === options.slug).sort();
  return slugs.map((slug) => {
    const state = readState(context.stateDir, slug);
    const found = runtimes.get(slug);
    const instances = found ? instanceFacts(found.runtime) : undefined;
    const url = ownInstances(instances ?? {}).find((instance) => instance.url !== undefined)?.url;
    const uptimeSeconds = instances ? longestUptime(instances) : undefined;
    const runtimeTarget = found?.runtime.db?.schema ?? found?.runtime.db?.filename;
    const directory = [state?.worktree, found?.dir].find((path) => path !== undefined && existsSync(path));
    const yaml = found ? join(found.dir, LOCAL_FILENAME) : directory ? join(directory, LOCAL_FILENAME) : undefined;
    return {
      slug,
      target: state?.target ?? runtimeTarget ?? (databaseSlugs.has(slug) ? context.adapter.target(slug) : ""),
      dialect: state?.dialect ?? context.adapter.dialect,
      statePath: state?.statePath ?? "",
      worktree: state?.worktree ?? found?.runtime.dir ?? found?.dir,
      createdAt: state?.createdAt ?? "",
      ...timesOf(directory, yaml),
      implodeClean: implodeWouldSucceed(context, slug, state?.worktree ?? found?.dir),
      exists: true,
      ...(found?.runtime.mode ? { mode: found.runtime.mode } : {}),
      ...(url ? { url } : {}),
      ...(instances && Object.keys(instances).length > 0 ? { instances } : {}),
      ...(uptimeSeconds === undefined ? {} : { uptimeSeconds }),
      ...(found?.runtime.log ? { log: found.runtime.log } : {}),
      ...(options.verbose && found ? { runtime: runtimeStatus(found, instances ?? {}) } : {}),
    };
  });
};
