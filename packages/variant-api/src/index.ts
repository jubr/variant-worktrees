import { existsSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { LOCAL_FILENAME, STATE_FILE } from "variant-config";
import { createDatabaseAdapter } from "./db/index.js";
import { loadVariantConfig } from "./mise.js";
import { createVariant } from "./operations/create.js";
import { deprovisionVariant } from "./operations/deprovision.js";
import { downVariant } from "./operations/down.js";
import { implodeVariant } from "./operations/implode.js";
import { initProject } from "./operations/init.js";
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
  if (config.db.multi !== undefined && config.db.dialect !== "postgres") {
    throw new Error(`db.multi needs PostgreSQL, not ${config.db.dialect}`);
  }
  const variantRoot = config.variant?.root ?? config.configDir;
  const stateDir = resolve(options.stateDir ?? defaultStateDir(config.configDir));
  /** The state directory is made when a command needs it, so `init` leaves nothing behind. */
  let stateReady = false;
  const ensureState = (): void => {
    if (!stateReady) {
      mkdirSync(stateDir, { recursive: true });
      migrateJsonStates(stateDir);
      stateReady = true;
    }
  };

  const withAdapter = async <T>(operation: (context: OperationContext) => Promise<T>): Promise<T> => {
    ensureState();
    const adapter = createDatabaseAdapter(config.db, stateDir);
    try {
      return await operation({
        config,
        variantRoot,
        stateDir,
        cwd,
        useWorktree: options.worktree ?? true,
        adapter,
        ...(options.now ? { now: options.now } : {}),
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
      ...directories.flatMap((path) => {
        const cache = join(path, ".cache", "variant");
        const cacheName = STATE_FILE.slice(STATE_FILE.lastIndexOf("/") + 1);
        return [
          {
            path,
            accept: (filename: string | null) =>
              filename === null || filename === LOCAL_FILENAME || filename === ".cache",
          },
          ...(existsSync(cache)
            ? [
                {
                  path: cache,
                  accept: (filename: string | null) => filename === null || filename === cacheName,
                },
              ]
            : []),
        ];
      }),
    ];
  };
  const subscriptions = createStateSubscriptions({
    read: async () => {
      let warning: string | undefined;
      const records = await withAdapter(async (context) => {
        const found = await listVariants(context);
        warning = context.contactWarning;
        return found;
      });
      return warning === undefined ? records : { records, warning };
    },
    targets: watchTargets,
    ...options.subscription,
  });

  return {
    create: (slug, options) => withAdapter((context) => createVariant(context, slug, options)),
    up: (slug, options) => withAdapter((context) => upVariant(context, slug, options)),
    watch: (slug, options) => withAdapter((context) => watchVariant(context, slug, options)),
    down: (slug, options) => withAdapter((context) => downVariant(context, slug, options)),
    deprovision: (slug, options) => withAdapter((context) => deprovisionVariant(context, slug, options)),
    implode: (slug, options) => withAdapter((context) => implodeVariant(context, slug, options)),
    list: (options) => withAdapter((context) => listVariants(context, options)),
    status: (slug) => withAdapter((context) => statusVariant(context, slug)),
    provision: (slug, options) => withAdapter((context) => provisionVariant(context, slug, options)),
    config: () => config,
    init: async (initOptions) => initProject({ cwd, miseBinPath: options.miseBinPath }, initOptions),
    subscribe: (listener) => {
      ensureState();
      return subscriptions.subscribe(listener);
    },
  };
};

export { loadConfig } from "variant-config";
export { worktreeReport } from "./cleanup.js";
export { listSlugs } from "./list-slugs.js";
export { LOG_LEVELS, type LogEvent, type LogLevel, type LogSink, log, setLogSink } from "./log.js";
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
  DeprovisionResult,
  DownResult,
  ImplodeResult,
  InitOptions,
  InitResult,
  ListOptions,
  MiseFailure,
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
