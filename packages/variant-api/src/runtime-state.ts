import { realpathSync, rmSync } from "node:fs";
import { join, relative } from "node:path";
import {
  clearRuntime,
  type ResolvedConfig,
  type ResolvedRuntime,
  RUNTIME_FILE,
  type Runtime,
  readRuntime,
  STATE_FILE,
  UI_WATCH_KEY,
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

/** The log file of the detached watch of the variant in `worktree`: `.cache/variant/watch.log`. */
export const watchLogPath = (config: ResolvedConfig, worktree: string): string =>
  join(variantConfigDir(config, worktree), ".cache", "variant", "watch.log");

/** The runtime state recorded in `worktree`, with `VARIANT_<KEY>_*` overrides applied to the configured watches. */
export const readVariantRuntime = (
  config: ResolvedConfig,
  worktree: string,
  env: NodeJS.ProcessEnv = process.env,
): ResolvedRuntime | undefined =>
  readRuntime(variantConfigDir(config, worktree), env, Object.keys(config.variant.watches));

/**
 * The `variant-ui` watch that the UI server recorded in the runtime state of `main`. `watch`, `up` and `down` rewrite
 * the runtime as a whole, so they carry this one reserved entry over; only the server that wrote it removes it.
 */
const recordedUiWatch = (dir: string): NonNullable<Runtime["watches"]>[string] | undefined => {
  try {
    return readRuntime(dir, {})?.watches?.[UI_WATCH_KEY];
  } catch {
    return undefined;
  }
};

export const writeVariantRuntime = (config: ResolvedConfig, worktree: string, runtime: Runtime): void => {
  const dir = variantConfigDir(config, worktree);
  const ui = recordedUiWatch(dir);
  writeRuntime(dir, ui ? { ...runtime, watches: { ...runtime.watches, [UI_WATCH_KEY]: ui } } : runtime);
};

/** Deletes the cache files of a variant. Does not rewrite a legacy `variants.local.yaml`. */
export const removeVariantRuntime = (config: ResolvedConfig, worktree: string): void => {
  const dir = variantConfigDir(config, worktree);
  rmSync(join(dir, STATE_FILE), { force: true });
  rmSync(join(dir, RUNTIME_FILE), { force: true });
};

export const clearVariantRuntime = (config: ResolvedConfig, worktree: string): void => {
  const dir = variantConfigDir(config, worktree);
  const ui = recordedUiWatch(dir);
  if (ui) {
    writeRuntime(dir, { watches: { [UI_WATCH_KEY]: ui } });
  } else {
    clearRuntime(dir);
  }
};

/** Whether a process with this id exists. A process that may not be signalled still exists. */
export const isProcessAlive = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
};
