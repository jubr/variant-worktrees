import { mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { loadConfig } from "variant-config";
import { createDatabaseAdapter } from "./db/index.js";
import { createVariant } from "./operations/create.js";
import { destroyVariant } from "./operations/destroy.js";
import { listVariants } from "./operations/list.js";
import { provisionVariant } from "./operations/provision.js";
import { switchVariant } from "./operations/switch.js";
import type { OperationContext } from "./operations/types.js";
import { migrateJsonStates } from "./state.js";
import type { VariantClient, VariantClientOptions } from "./types.js";

export const createClient = (options: VariantClientOptions = {}): VariantClient => {
  const cwd = resolve(options.cwd ?? process.cwd());
  const config = options.config ?? loadConfig({ cwd, configPath: options.configPath ?? process.env.VARIANT_CONFIG });
  const stateDir = resolve(options.stateDir ?? join(config.configDir, ".cache", "variants"));
  mkdirSync(stateDir, { recursive: true });
  migrateJsonStates(stateDir);

  const withAdapter = async <T>(operation: (context: OperationContext) => Promise<T>): Promise<T> => {
    const adapter = createDatabaseAdapter(config.db, stateDir);
    try {
      return await operation({
        config,
        stateDir,
        cwd,
        useWorktree: options.worktree ?? true,
        adapter,
      });
    } finally {
      await adapter.close();
    }
  };

  return {
    create: (slug) => withAdapter((context) => createVariant(context, slug)),
    destroy: (slug) => withAdapter((context) => destroyVariant(context, slug)),
    list: () => withAdapter((context) => listVariants(context)),
    switch: async (slug) => {
      const adapter = createDatabaseAdapter(config.db, stateDir);
      try {
        return switchVariant(
          {
            config,
            stateDir,
            cwd,
            useWorktree: options.worktree ?? true,
            adapter,
          },
          slug,
        );
      } finally {
        await adapter.close();
      }
    },
    provision: (slug) => withAdapter((context) => provisionVariant(context, slug)),
    config: () => config,
  };
};

export { loadConfig } from "variant-config";
export { resolveSlug, sanitizeSlug } from "./slug.js";
export type {
  DatabaseAdapter,
  VariantClient,
  VariantClientOptions,
  VariantRecord,
  VariantState,
} from "./types.js";
export { ensureWorktree, primaryWorktree, switchWorktree } from "./worktree.js";
