import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import type { ChatRenamerConfig } from "chat-renamer-config/schema";
import { parse as parseYaml } from "yaml";
import { detectConnection, detectInstances, detectVariantRoot } from "./autodetect.js";
import type { DbConfig, ResolvedConfig, VariantInstance, VariantsConfig } from "./schema.js";
import { DEFAULT_CACHE_DIR, DEFAULT_PREFIX, VariantsConfigSchema, variantsJsonSchema } from "./schema.js";

const CONFIG_FILENAMES = ["variants.yaml", "variants.yml"] as const;

const ancestorDirectories = (startDir: string): string[] => {
  const directories: string[] = [];
  let current = resolve(startDir);
  while (!directories.includes(current)) {
    directories.push(current);
    const parent = dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }
  return directories;
};

export const findConfigFile = (startDir = process.cwd()): string | undefined => {
  for (const directory of ancestorDirectories(startDir)) {
    for (const filename of CONFIG_FILENAMES) {
      const path = join(directory, filename);
      if (existsSync(path)) {
        return path;
      }
    }
  }
  return undefined;
};

const readConfigFile = (configPath: string): VariantsConfig => {
  const parsed: unknown = parseYaml(readFileSync(configPath, "utf8"));
  return VariantsConfigSchema.parse(parsed ?? {});
};

const mergeDbConfig = (detected: DbConfig, explicit: DbConfig | undefined): DbConfig => ({
  ...detected,
  ...explicit,
});

const resolveInstances = (config: VariantsConfig, configDir: string): VariantInstance[] => {
  if (config.variant?.instances !== undefined) {
    return config.variant.instances;
  }
  return detectInstances(configDir);
};

export interface LoadConfigOptions {
  cwd?: string;
  configPath?: string;
}

export const loadConfig = (options: LoadConfigOptions = {}): ResolvedConfig => {
  const cwd = resolve(options.cwd ?? process.cwd());
  const configPath = options.configPath
    ? resolve(cwd, options.configPath)
    : (findConfigFile(cwd) ?? join(cwd, "variants.yaml"));
  const configExists = existsSync(configPath);
  const config = configExists ? readConfigFile(configPath) : {};
  const configDir = dirname(configPath);
  const detected = detectConnection(configDir);
  const db = mergeDbConfig(detected.config, config.db);
  const source = config.db ? "config" : detected.source;
  const variant = {
    ...config.variant,
    root: config.variant?.root ? resolve(configDir, config.variant.root) : detectVariantRoot(configDir),
    prefix: config.variant?.prefix ?? DEFAULT_PREFIX,
    cacheDir: resolve(configDir, config.variant?.cacheDir ?? DEFAULT_CACHE_DIR),
    instances: resolveInstances(config, configDir),
  };

  return {
    ...config,
    db,
    variant,
    configPath,
    configDir,
    source,
  };
};

export const seedCommandFor = (config: ResolvedConfig, slug: string): string | undefined =>
  config.variants?.[slug]?.seed ?? config.variant?.seed;

export const runtimeCommandFor = (
  config: ResolvedConfig,
  kind: "up" | "watch",
  instance?: VariantInstance,
): string | undefined => instance?.[kind] ?? config.variant?.[kind];

/**
 * Only the variant name prefix of the nearest variants.yaml. Unlike loadConfig it detects no database settings, so it is
 * cheap and safe to call from an editor extension. Falls back to the default when the file is missing or invalid.
 */
export const readPrefix = (startDir = process.cwd()): string => {
  const configPath = findConfigFile(startDir);
  if (!configPath) {
    return DEFAULT_PREFIX;
  }
  try {
    return readConfigFile(configPath).variant?.prefix ?? DEFAULT_PREFIX;
  } catch {
    return DEFAULT_PREFIX;
  }
};

/**
 * Only the `chatRenamer` section of the nearest variants.yaml, without database detection, so an editor extension can
 * call it cheaply. An empty section when the file is missing or invalid.
 */
export const readChatRenamerConfig = (startDir = process.cwd()): ChatRenamerConfig => {
  const configPath = findConfigFile(startDir);
  if (!configPath) {
    return {};
  }
  try {
    return readConfigFile(configPath).chatRenamer ?? {};
  } catch {
    return {};
  }
};

export const writeJsonSchema = (): string => JSON.stringify(variantsJsonSchema, null, 2);

export { detectConnection, detectInstances, detectVariantRoot, findMiseFile } from "./autodetect.js";
export { openUrlFor, resolveInstancePort } from "./ports.js";
export type {
  DbConfig,
  DbDialect,
  ResolvedConfig,
  VariantEntry,
  VariantInstance,
  VariantRuntime,
  VariantsConfig,
} from "./schema.js";
export {
  DEFAULT_CACHE_DIR,
  DEFAULT_OPEN_URL,
  DEFAULT_PREFIX,
  VariantsConfigSchema,
  variantsJsonSchema,
} from "./schema.js";
export type { ChatRenamerConfig };
