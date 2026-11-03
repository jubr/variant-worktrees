import { existsSync, readFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import type { ChatRenamerConfig } from "chat-renamer-config/schema";
import { parse as parseYaml } from "yaml";
import { abbreviate, detectConnection, detectVariantMain, detectVariantRoot, detectWatches } from "./autodetect.js";
import { migrateLegacy } from "./legacy.js";
import { readRuntimeState } from "./local.js";
import { type ParsedConfig, parseConfig } from "./parse.js";
import type { DbConfig, ResolvedConfig, ResolvedVariant, VariantsConfig, VariantWatch } from "./schema.js";
import {
  DEFAULT_BASE_BRANCH,
  DEFAULT_BRANCH_PREFIXES,
  DEFAULT_MAX_DIFF_LINES,
  DEFAULT_PORT_RANGE,
  DEFAULT_PREFIX,
  DEFAULT_STORAGE_DIR,
  DEFAULT_STORAGE_ENV_VAR,
  parsePortRange,
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

interface ReadConfig extends ParsedConfig<VariantsConfig> {
  /** The notices of names of an earlier version that were read under the current names. */
  migrations: string[];
}

const readConfigFile = (configPath: string): ReadConfig => {
  const parsed: unknown = parseYaml(readFileSync(configPath, "utf8"));
  const { data, notices } = migrateLegacy(parsed ?? {}, configPath);
  return { ...parseConfig(VariantsConfigSchema, data, configPath), migrations: notices };
};

const mergeDbConfig = (detected: DbConfig, explicit: DbConfig | undefined): DbConfig => ({
  ...detected,
  ...explicit,
});

/** The configured watches with `dir` defaulted to the key, else the autodetected ones (which carry their `dir`). */
const resolveWatches = (config: VariantsConfig, configDir: string): Record<string, VariantWatch> =>
  config.variant?.watches
    ? Object.fromEntries(
        Object.entries(config.variant.watches).map(([key, watch]) => [key, { ...watch, dir: watch.dir ?? key }]),
      )
    : detectWatches(configDir);

/** `variant.open`, unless `VARIANT_OPEN=0` turns opening off. */
const resolveOpen = (configured: boolean | undefined, env: NodeJS.ProcessEnv): boolean =>
  env.VARIANT_OPEN === "0" ? false : (configured ?? true);

const resolvePorts = (configured: string | undefined): ResolvedVariant["ports"] => {
  const range = configured ?? DEFAULT_PORT_RANGE;
  const { low, high } = parsePortRange(range) as { low: number; high: number };
  return { range, low, high };
};

const resolveVariant = (config: VariantsConfig, configDir: string, env: NodeJS.ProcessEnv): ResolvedVariant => {
  const { storage, supervise, implode, ports, ...variant } = config.variant ?? {};
  const main = variant.main ? resolve(configDir, variant.main) : detectVariantMain(configDir);
  return {
    ...variant,
    main,
    root: variant.root ? resolve(configDir, variant.root) : detectVariantRoot(configDir, main),
    abbr: variant.abbr ?? abbreviate(basename(main)),
    prefix: variant.prefix ?? DEFAULT_PREFIX,
    watches: resolveWatches(config, configDir),
    baseBranch: variant.baseBranch ?? DEFAULT_BASE_BRANCH,
    branchPrefixes: variant.branchPrefixes ?? [...DEFAULT_BRANCH_PREFIXES],
    open: resolveOpen(variant.open, env),
    ports: resolvePorts(ports?.range),
    ...(storage
      ? {
          storage: {
            dir: storage.dir ?? DEFAULT_STORAGE_DIR,
            envVarName: storage.envVarName ?? DEFAULT_STORAGE_ENV_VAR,
          },
        }
      : {}),
    supervise: {
      startDelaySeconds: supervise?.startDelaySeconds ?? 2,
      readyTimeoutSeconds: supervise?.readyTimeoutSeconds ?? 180,
      checkoutPollSeconds: supervise?.checkoutPollSeconds ?? 5,
    },
    implode: {
      preRm: implode?.preRm ?? [],
      discard: implode?.discard ?? [],
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
  const read: ReadConfig = configExists ? readConfigFile(configPath) : { data: {}, warnings: [], migrations: [] };
  const config = read.data;
  const configDir = dirname(configPath);
  const detected = detectConnection(configDir);
  const db = mergeDbConfig(detected.config, config.db);
  const source = config.db ? "config" : detected.source;
  const env = options.env ?? process.env;
  const variant = resolveVariant(config, configDir, env);
  const { runtime, migrations } = readRuntimeState(configDir, env, Object.keys(variant.watches));

  return {
    ...config,
    db,
    variant,
    ...(runtime ? { runtime } : {}),
    configPath,
    configDir,
    source,
    warnings: read.warnings,
    migrations: [...read.migrations, ...migrations],
  };
};

export const seedCommandFor = (config: ResolvedConfig, slug: string): string | undefined =>
  config.variants?.[slug]?.seed ?? config.variant.seed;

export const runtimeCommandFor = (kind: "up" | "watch", watch: VariantWatch): string | undefined => watch[kind];

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
    return readConfigFile(configPath).data.variant?.prefix ?? DEFAULT_PREFIX;
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
    return readConfigFile(configPath).data.chatRenamer ?? {};
  } catch {
    return {};
  }
};

export const writeJsonSchema = (): string => JSON.stringify(variantsJsonSchema, null, 2);

export {
  abbreviate,
  detectConnection,
  detectVariantMain,
  detectVariantRoot,
  detectWatches,
  findMiseFile,
} from "./autodetect.js";
export { amendDotenv, dotenvFor } from "./dotenv.js";
export { type Migrated, migrateLegacy, migrateText } from "./legacy.js";
export type { DiscoveredRuntime, LocalState, ReadRuntimesOptions, RuntimeReadError } from "./local.js";
export { clearRuntime, readRuntime, readRuntimeState, readRuntimes, writeRuntime } from "./local.js";
export { type MigrationResult, migrateFile } from "./migrate-file.js";
export { type ParsedConfig, parseConfig } from "./parse.js";
export { openUrlFor, type PickFreePortOptions, pickFreePort, resolveWatchPort } from "./ports.js";
export type {
  DbConfig,
  DbDialect,
  PortRange,
  ResolvedConfig,
  ResolvedRuntime,
  Runtime,
  VariantEntry,
  VariantRuntime,
  VariantsConfig,
  VariantsLocal,
  VariantWatch,
  WatchContainer,
} from "./schema.js";
export {
  DEFAULT_PORT_RANGE,
  DEFAULT_PREFIX,
  DEFAULT_URL,
  envSegment,
  LOCAL_FILENAME,
  UI_PORT_ENV,
  UI_WATCH_KEY,
  VariantsConfigSchema,
  VariantsLocalSchema,
  variantsJsonSchema,
  variantsLocalJsonSchema,
} from "./schema.js";
export { renderTemplate, type TemplateContext } from "./template.js";
export { resolveMainVscodeDir } from "./vscode-dir.js";
export type { ChatRenamerConfig };
