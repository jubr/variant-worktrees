import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import type { ChatRenamerConfig } from "chat-renamer-config/schema";
import { parse as parseYaml } from "yaml";
import { detectConnection, detectInstances, detectVariantRoot } from "./autodetect.js";
import { readRuntime } from "./local.js";
import type { DbConfig, ResolvedConfig, ResolvedVariant, VariantInstance, VariantsConfig } from "./schema.js";
import {
  DEFAULT_BASE_BRANCH,
  DEFAULT_BRANCH_PREFIXES,
  DEFAULT_MAX_DIFF_LINES,
  DEFAULT_PREFIX,
  DEFAULT_RESERVED_PORTS,
  DEFAULT_STORAGE_DIR,
  DEFAULT_STORAGE_ENV,
  VariantsConfigSchema,
  variantsJsonSchema,
} from "./schema.js";

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

const resolveInstances = (config: VariantsConfig, configDir: string): Record<string, VariantInstance> =>
  config.variant?.instances ?? detectInstances(configDir);

/** `variant.open`, unless `VARIANT_OPEN=0` turns opening off. */
const resolveOpen = (configured: boolean | undefined, env: NodeJS.ProcessEnv): boolean =>
  env.VARIANT_OPEN === "0" ? false : (configured ?? true);

const resolveVariant = (config: VariantsConfig, configDir: string, env: NodeJS.ProcessEnv): ResolvedVariant => {
  const { storage, supervise, implode, ...variant } = config.variant ?? {};
  return {
    ...variant,
    root: variant.root ? resolve(configDir, variant.root) : detectVariantRoot(configDir),
    prefix: variant.prefix ?? DEFAULT_PREFIX,
    instances: resolveInstances(config, configDir),
    baseBranch: variant.baseBranch ?? DEFAULT_BASE_BRANCH,
    branchPrefixes: variant.branchPrefixes ?? [...DEFAULT_BRANCH_PREFIXES],
    open: resolveOpen(variant.open, env),
    reservedPorts: variant.reservedPorts ?? [...DEFAULT_RESERVED_PORTS],
    ...(storage
      ? { storage: { dir: storage.dir ?? DEFAULT_STORAGE_DIR, env: storage.env ?? DEFAULT_STORAGE_ENV } }
      : {}),
    supervise: {
      startDelaySeconds: supervise?.startDelaySeconds ?? 2,
      readyTimeoutSeconds: supervise?.readyTimeoutSeconds ?? 180,
      checkoutPollSeconds: supervise?.checkoutPollSeconds ?? 5,
    },
    implode: {
      preRm: implode?.preRm ?? [],
      restore: implode?.restore ?? [],
      untracked: implode?.untracked ?? [],
      requireMerged: implode?.requireMerged ?? true,
      maxDiffLines: implode?.maxDiffLines ?? DEFAULT_MAX_DIFF_LINES,
    },
  };
};

export interface LoadConfigOptions {
  cwd?: string;
  configPath?: string;
  /** Environment for `VARIANT_*` overrides and `{{NAME}}` templates; the process environment by default. */
  env?: NodeJS.ProcessEnv;
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
  const env = options.env ?? process.env;
  const variant = resolveVariant(config, configDir, env);
  const runtime = readRuntime(configDir, env, Object.keys(variant.instances));

  return {
    ...config,
    db,
    variant,
    ...(runtime ? { runtime } : {}),
    configPath,
    configDir,
    source,
  };
};

export const seedCommandFor = (config: ResolvedConfig, slug: string): string | undefined =>
  config.variants?.[slug]?.seed ?? config.variant.seed;

export const runtimeCommandFor = (
  config: ResolvedConfig,
  kind: "up" | "watch",
  instance?: VariantInstance,
): string | undefined => instance?.[kind] ?? config.variant[kind];

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
export { amendDotenv, dotenvFor } from "./dotenv.js";
export type { DiscoveredRuntime, ReadRuntimesOptions, RuntimeReadError } from "./local.js";
export { clearRuntime, readRuntime, readRuntimes, writeRuntime } from "./local.js";
export { openUrlFor, pickFreePort, resolveInstancePort } from "./ports.js";
export type {
  DbConfig,
  DbDialect,
  InstanceContainer,
  ResolvedConfig,
  ResolvedRuntime,
  Runtime,
  VariantEntry,
  VariantInstance,
  VariantRuntime,
  VariantsConfig,
  VariantsLocal,
} from "./schema.js";
export {
  DEFAULT_OPEN_URL,
  DEFAULT_PREFIX,
  envSegment,
  LOCAL_FILENAME,
  VariantsConfigSchema,
  VariantsLocalSchema,
  variantsJsonSchema,
  variantsLocalJsonSchema,
} from "./schema.js";
export { renderTemplate, type TemplateContext } from "./template.js";
export { resolveMainVscodeDir } from "./vscode-dir.js";
export type { ChatRenamerConfig };
