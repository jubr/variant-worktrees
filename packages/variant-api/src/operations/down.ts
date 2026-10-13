import { existsSync, rmSync } from "node:fs";
import {
  containerName,
  engineHas,
  findContainerEngine,
  networkName,
  nginxConfigPath,
  runEngine,
} from "../containers.js";
import { locateWorktree } from "../locate.js";
import { ownedByWorktree, stopProcessTree } from "../processes.js";
import { clearVariantRuntime, readVariantRuntime } from "../runtime-state.js";
import { resolveSlug } from "../slug.js";
import type { DownResult } from "../types.js";
import type { OperationContext } from "./types.js";

/** Terminates the host processes recorded for a variant, with their children. Returns the ones that were stopped. */
export const stopHostProcesses = async (
  context: OperationContext,
  worktree: string,
): Promise<DownResult["processes"]> => {
  const runtime = readVariantRuntime(context.config, worktree);
  const stopped: DownResult["processes"] = [];
  for (const [key, instance] of Object.entries(runtime?.instances ?? {})) {
    if (instance.pid !== undefined && ownedByWorktree(instance.pid, worktree)) {
      await stopProcessTree(instance.pid);
      stopped.push({ key, pid: instance.pid });
    }
  }
  return stopped;
};

/** Removes the containers, the network and the generated web server configuration of a variant. */
export const stopContainers = (
  context: OperationContext,
  slug: string,
): Pick<DownResult, "containers" | "networks"> => {
  const { config, stateDir } = context;
  const keys = Object.entries(config.variant.instances)
    .filter(([, instance]) => instance.container !== undefined)
    .map(([key]) => key);
  const result: Pick<DownResult, "containers" | "networks"> = { containers: [], networks: [] };
  for (const key of keys) {
    const conf = nginxConfigPath(stateDir, slug, key);
    if (existsSync(conf)) {
      rmSync(conf);
    }
  }
  const engine = keys.length > 0 ? findContainerEngine(config) : undefined;
  if (!engine) {
    return result;
  }
  for (const key of keys) {
    const name = containerName(key, slug);
    if (engineHas(engine, "container", name)) {
      runEngine(engine, ["rm", "-f", name]);
      result.containers.push(name);
    }
  }
  const network = networkName(slug);
  if (engineHas(engine, "network", network)) {
    runEngine(engine, ["network", "rm", network]);
    result.networks.push(network);
  }
  return result;
};

/** Stops what runs for a variant (processes and containers) and clears its runtime state; keeps all data. */
export const downVariant = async (context: OperationContext, requestedSlug?: string): Promise<DownResult> => {
  const slug = resolveSlug(requestedSlug, context.cwd, context.config.variant.branchPrefixes);
  const worktree = locateWorktree(context, slug);
  const processes = worktree ? await stopHostProcesses(context, worktree) : [];
  const containers = stopContainers(context, slug);
  if (worktree) {
    clearVariantRuntime(context.config, worktree);
  }
  return { slug, processes, ...containers };
};
