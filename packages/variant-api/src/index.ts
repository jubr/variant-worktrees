import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { LOCAL_FILENAME } from "variant-config";
import { createDatabaseAdapter } from "./db/index.js";
import { loadVariantConfig } from "./mise.js";
import { createVariant } from "./operations/create.js";
import { downVariant } from "./operations/down.js";
import { implodeVariant } from "./operations/implode.js";
import { listVariants } from "./operations/list.js";
import { provisionVariant } from "./operations/provision.js";
import { runtimeDirectories } from "./operations/records.js";
import { statusVariant } from "./operations/status.js";
import type { OperationContext } from "./operations/types.js";
import { upVariant } from "./operations/up.js";
import { watchVariant } from "./operations/watch.js";
import { defaultStateDir, migrateJsonStates } from "./state.js";
import { createStateSubscriptions, type WatchTarget } from "./subscribe.js";
import type { VariantClient, VariantClientOptions } from "./types.js";

export const createClient = (options: VariantClientOptions = {}): VariantClient => {
  const cwd = resolve(options.cwd ?? process.cwd());
  const config =
    options.config ??
    loadVariantConfig({
      cwd,
      configPath: options.configPath ?? process.env.VARIANT_CONFIG,
      miseBinPath: options.miseBinPath,
    });
  const variantRoot = config.variant?.root ?? config.configDir;
  const stateDir = resolve(options.stateDir ?? defaultStateDir(config.configDir));
  mkdirSync(stateDir, { recursive: true });
  migrateJsonStates(stateDir);

  const withAdapter = async <T>(operation: (context: OperationContext) => Promise<T>): Promise<T> => {
    const adapter = createDatabaseAdapter(config.db, stateDir);
    try {
      return await operation({
        config,
        variantRoot,
        stateDir,
        cwd,
        useWorktree: options.worktree ?? true,
        adapter,
      });
    } finally {
      await adapter.close();
    }
  };

  /** The directories that decide the records: the state files, the variant worktrees and the main checkout. */
  const watchTargets = (): WatchTarget[] => {
    const { root, prefix, directories } = runtimeDirectories(config);
    return [
      { path: stateDir },
      { path: root, accept: (filename) => filename === null || filename.startsWith(prefix) },
      ...directories.map((path) => ({
        path,
        accept: (filename: string | null) => filename === null || filename === LOCAL_FILENAME,
      })),
    ];
  };
  const subscriptions = createStateSubscriptions({
    read: () => withAdapter((context) => listVariants(context)),
    targets: watchTargets,
    ...options.subscription,
  });

  return {
    create: (slug) => withAdapter((context) => createVariant(context, slug)),
    up: (slug, options) => withAdapter((context) => upVariant(context, slug, options)),
    watch: (slug, options) => withAdapter((context) => watchVariant(context, slug, options)),
    down: (slug, options) => withAdapter((context) => downVariant(context, slug, options)),
    implode: (slug, options) => withAdapter((context) => implodeVariant(context, slug, options)),
    list: (options) => withAdapter((context) => listVariants(context, options)),
    status: (slug) => withAdapter((context) => statusVariant(context, slug)),
    provision: (slug, options) => withAdapter((context) => provisionVariant(context, slug, options)),
    config: () => config,
    subscribe: subscriptions.subscribe,
  };
};

export { loadConfig } from "variant-config";
export { listSlugs } from "./list-slugs.js";
export {
  type LoadVariantConfigOptions,
  loadVariantConfig,
  MiseError,
  miseBinaryFor,
  miseEnvironment,
  readVariableSources,
  runMiseTrust,
} from "./mise.js";
export { type AugmentMiseOptions, type AugmentMiseResult, augmentMiseConfig, MISE_TOOL } from "./mise-augment.js";
export { redacted } from "./redact.js";
export { resolveSlug, sanitizeSlug } from "./slug.js";
export type {
  DatabaseAdapter,
  DownResult,
  ImplodeResult,
  ListOptions,
  RuntimeStatus,
  UpResult,
  VariantClient,
  VariantClientOptions,
  VariantRecord,
  VariantState,
  VariantUpdate,
  WatchFacts,
  WatchReport,
  WatchResult,
} from "./types.js";
export { ensureWorktree, primaryWorktree } from "./worktree.js";
