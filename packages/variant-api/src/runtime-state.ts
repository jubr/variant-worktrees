import { realpathSync } from "node:fs";
import { join, relative } from "node:path";
import {
  clearRuntime,
  type ResolvedConfig,
  type ResolvedRuntime,
  type Runtime,
  readRuntime,
  writeRuntime,
} from "variant-config";
import { gitRoot } from "./slug.js";

/**
 * Where the `variants.local.yaml` of a variant lives: the directory of `variants.yaml` re-based from the checkout it was
 * loaded from onto `worktree`, which is the worktree itself in the common layout. Outside a git repository there is no
 * other checkout and it is the configuration directory.
 */
export const variantConfigDir = (config: ResolvedConfig, worktree: string): string => {
  try {
    const root = realpathSync(gitRoot(config.configDir));
    return join(worktree, relative(root, realpathSync(config.configDir)));
  } catch {
    return config.configDir;
  }
};

/** The runtime state recorded in `worktree`, with `VARIANT_<KEY>_*` overrides applied to the configured instances. */
export const readVariantRuntime = (
  config: ResolvedConfig,
  worktree: string,
  env: NodeJS.ProcessEnv = process.env,
): ResolvedRuntime | undefined =>
  readRuntime(variantConfigDir(config, worktree), env, Object.keys(config.variant.instances));

export const writeVariantRuntime = (config: ResolvedConfig, worktree: string, runtime: Runtime): void =>
  writeRuntime(variantConfigDir(config, worktree), runtime);

export const clearVariantRuntime = (config: ResolvedConfig, worktree: string): void =>
  clearRuntime(variantConfigDir(config, worktree));

/** Whether a process with this id exists. A process that may not be signalled still exists. */
export const isProcessAlive = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
};
