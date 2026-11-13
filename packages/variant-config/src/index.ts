import { execFileSync } from "node:child_process";
import { existsSync, lstatSync, readFileSync, realpathSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import type { ChatRenamerConfig } from "chat-renamer-config/schema";
import { parse as parseYaml } from "yaml";
import {
  abbreviate,
  detectConnection,
  detectOnboarding,
  detectVariantMain,
  detectVariantRoot,
  detectWatches,
  type EnvironmentProvider,
} from "./autodetect.js";
import { migrateLegacy } from "./legacy.js";
import { readRuntimeState } from "./local.js";
import {
  applyTemplateOrigins,
  configFileOrigin,
  fillDbOrigins,
  fillDefaultOrigins,
  fillGapOrigins,
  originsFromRaw,
} from "./origins.js";
import { type ParsedConfig, parseConfig } from "./parse.js";
import {
  type DbConfig,
  DEFAULT_BASE_BRANCH,
  DEFAULT_BRANCH_PREFIXES,
  DEFAULT_MAX_DIFF_LINES,
  DEFAULT_PORT_RANGE,
  DEFAULT_PREFIX,
  DEFAULT_STORAGE_DIR,
  DEFAULT_STORAGE_ENV_VAR,
  parsePortRange,
  type ResolvedConfig,
  type ResolvedVariant,
  resolveSteps,
  type VariantsConfig,
  VariantsConfigSchema,
  type VariantWatch,
  variantsJsonSchema,
} from "./schema.js";
import { renderTemplate } from "./template.js";

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

const isSymbolicLink = (path: string): boolean => {
  try {
    return lstatSync(path).isSymbolicLink();
  } catch {
    return false;
  }
};

const isGitCheckout = (directory: string): boolean => {
  try {
    execFileSync("git", ["-C", directory, "rev-parse", "--is-inside-work-tree"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
};

/** The real `variants.yaml` in the checkout named by an `AGENTS.md` symlink in `directory`. */
const configFromAgentsSymlink = (directory: string): string | undefined => {
  const agents = join(directory, "AGENTS.md");
  if (!isSymbolicLink(agents)) {
    return undefined;
  }
  let checkout: string;
  try {
    checkout = dirname(realpathSync(agents));
  } catch {
    return undefined;
  }
  if (!isGitCheckout(checkout)) {
    return undefined;
  }
  for (const filename of CONFIG_FILENAMES) {
    const path = join(checkout, filename);
    if (existsSync(path) && !isSymbolicLink(path)) {
      return path;
    }
  }
  return undefined;
};

interface ConfigFileDiscovery {
  path?: string;
  warnings: string[];
}

const gitOutput = (directory: string, args: string[]): string | undefined => {
  try {
    return execFileSync("git", ["-C", directory, ...args], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return undefined;
  }
};

const sameDirectory = (left: string, right: string): boolean => {
  try {
    return realpathSync(left) === realpathSync(right);
  } catch {
    return resolve(left) === resolve(right);
  }
};

/**
 * The git toplevel when `startDir` is inside a linked worktree, not the primary checkout.
 * Specification: openspec/specs/variant-config/core/spec.md
 */
/** A checkout has a `.git` entry at or above `startDir`. A variant root has none, so git is not asked. */
const insideCheckout = (startDir: string): boolean => {
  let directory = resolve(startDir);
  for (;;) {
    if (existsSync(join(directory, ".git"))) {
      return true;
    }
    const parent = dirname(directory);
    if (parent === directory) {
      return false;
    }
    directory = parent;
  }
};

const linkedWorktreeRoot = (startDir: string): string | undefined => {
  if (!insideCheckout(startDir)) {
    return undefined;
  }
  const toplevel = gitOutput(resolve(startDir), ["rev-parse", "--show-toplevel"]);
  if (!toplevel) {
    return undefined;
  }
  const gitDir = gitOutput(toplevel, ["rev-parse", "--git-dir"]);
  const commonDir = gitOutput(toplevel, ["rev-parse", "--git-common-dir"]);
  if (!gitDir || !commonDir) {
    return undefined;
  }
  if (sameDirectory(resolve(toplevel, gitDir), resolve(toplevel, commonDir))) {
    return undefined;
  }
  try {
    return realpathSync(toplevel);
  } catch {
    return resolve(toplevel);
  }
};

const searchConfigFiles = (directories: readonly string[], warnings: string[]): string | undefined => {
  for (const directory of directories) {
    for (const filename of CONFIG_FILENAMES) {
      const path = join(directory, filename);
      if (!existsSync(path)) {
        continue;
      }
      if (isSymbolicLink(path) && configFromAgentsSymlink(directory)) {
        warnings.push(`${path}: a variants.yaml symlink in the variant root is an anti-pattern`);
        continue;
      }
      return path;
    }
  }
  return undefined;
};

const configFileAt = (directory: string): string | undefined => {
  for (const filename of CONFIG_FILENAMES) {
    const path = join(directory, filename);
    if (existsSync(path)) {
      return path;
    }
  }
  return undefined;
};

const discoverConfigFile = (startDir: string): ConfigFileDiscovery => {
  const warnings: string[] = [];
  const ancestors = ancestorDirectories(startDir);
  const worktree = linkedWorktreeRoot(startDir);
  if (worktree) {
    const bounded: string[] = [];
    for (const directory of ancestors) {
      bounded.push(directory);
      if (sameDirectory(directory, worktree)) {
        break;
      }
    }
    const found = searchConfigFiles(bounded, warnings);
    if (found) {
      return { path: found, warnings };
    }
    const atRoot = configFileAt(worktree);
    if (atRoot) {
      return { path: atRoot, warnings };
    }
  }
  const found = searchConfigFiles(ancestors, warnings);
  if (found) {
    return { path: found, warnings };
  }
  for (const directory of ancestors) {
    const linked = configFromAgentsSymlink(directory);
    if (linked) {
      return { path: linked, warnings };
    }
  }
  return { warnings };
};

export const findConfigFile = (startDir = process.cwd()): string | undefined => discoverConfigFile(startDir).path;

/** Whether a directory already uses Variant, only looks ready for it, or does not. */
export type VariantsAdoption =
  | { status: "active" }
  | { status: "detected"; label: string }
  | { status: "none"; error?: unknown };

/**
 * Adoption of `dir`. A config file is `active` and does not read the environment. Otherwise the onboarding detection
 * runs: a database plus an application is `detected`, and anything else, including an environment failure, is `none`.
 *
 * Specification: openspec/specs/variant-config/adoption/spec.md
 */
export const getVariantsAdoption = (
  dir: string,
  environment: EnvironmentProvider = () => process.env,
): VariantsAdoption => {
  if (findConfigFile(dir) !== undefined) {
    return { status: "active" };
  }
  const detected = detectOnboarding(dir, environment);
  if (detected.label !== undefined) {
    return { status: "detected", label: detected.label };
  }
  if (detected.error !== undefined) {
    return { status: "none", error: detected.error };
  }
  return { status: "none" };
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

/** Explicit fields win. An explicit SQLite database takes nothing from detection, so the environment stays unread. */
const mergeDbConfig = (detected: Partial<DbConfig>, explicit: DbConfig | undefined): DbConfig =>
  ({
    ...detected,
    ...explicit,
  }) as DbConfig;

const memoize = <Value>(compute: () => Value): (() => Value) => {
  let cached: { value: Value } | undefined;
  return () => {
    cached ??= { value: compute() };
    return cached.value;
  };
};

/** A watch with `dir` set; a `dir` that references the environment is expanded when first read. */
const withDir = (
  watch: Omit<VariantWatch, "dir">,
  key: string,
  dir: string,
  environment: EnvironmentProvider,
): VariantWatch => {
  if (!dir.includes("${")) {
    return { ...watch, dir };
  }
  const copy = { ...watch, dir } as VariantWatch;
  Object.defineProperty(copy, "dir", {
    enumerable: true,
    configurable: true,
    get: memoize(() =>
      renderTemplate(dir, { env: environment, variant: false, setting: `variant.watches.${key}.dir` }),
    ),
  });
  return copy;
};

/** The configured watches with `dir` defaulted to the key, else the autodetected ones (which carry their `dir`). */
const resolveWatches = (
  config: VariantsConfig,
  configDir: string,
  environment: EnvironmentProvider,
): Record<string, VariantWatch> =>
  config.variant?.watches
    ? Object.fromEntries(
        Object.entries(config.variant.watches).map(([key, watch]) => [
          key,
          withDir(watch, key, watch.dir ?? key, environment),
        ]),
      )
    : detectWatches(configDir);

const positivePort = (value: string, setting: string): number => {
  const port = Number(value);
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(`${setting}: expected a positive integer, received ${value}`);
  }
  return port;
};

/** `db` with the environment references of its text settings expanded; `db` belongs to no variant. */
const expandDb = (db: DbConfig, environment: EnvironmentProvider): DbConfig => {
  const expanded = Object.fromEntries(
    Object.entries(db).map(([name, value]) => [
      name,
      typeof value === "string"
        ? renderTemplate(value, { env: environment, variant: false, setting: `db.${name}` })
        : value,
    ]),
  ) as DbConfig;
  if (typeof expanded.port === "string") {
    expanded.port = positivePort(expanded.port, "db.port");
  }
  return expanded;
};

/** `variant.open`, unless `VARIANT_OPEN=0` turns opening off. */
const resolveOpen = (configured: boolean | undefined, env: NodeJS.ProcessEnv): boolean =>
  env.VARIANT_OPEN === "0" ? false : (configured ?? true);

const resolvePorts = (configured: string | undefined): ResolvedVariant["ports"] => {
  const range = configured ?? DEFAULT_PORT_RANGE;
  const { low, high } = parsePortRange(range) as { low: number; high: number };
  return { range, low, high };
};

const resolveVariant = (
  config: VariantsConfig,
  configDir: string,
  env: NodeJS.ProcessEnv,
  environment: EnvironmentProvider,
): ResolvedVariant => {
  const { storage, supervise, implode, ports, steps, ...variant } = config.variant ?? {};
  const main = variant.main ? resolve(configDir, variant.main) : detectVariantMain(configDir);
  return {
    ...variant,
    steps: resolveSteps(steps),
    main,
    root: variant.root ? resolve(configDir, variant.root) : detectVariantRoot(configDir, main),
    abbr: variant.abbr ?? abbreviate(basename(main)),
    prefix: variant.prefix ?? DEFAULT_PREFIX,
    watches: resolveWatches(config, configDir, environment),
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
  /** Environment for `VARIANT_*` overrides and `${NAME}` templates; the process environment by default. */
  env?: NodeJS.ProcessEnv;
  /**
   * Supplies the environment that database autodetection reads. It is called lazily, at most once per loaded
   * configuration, and not at all when nothing reads `db`. The process environment by default.
   */
  environment?: EnvironmentProvider;
}

export const loadConfig = (options: LoadConfigOptions = {}): ResolvedConfig => {
  const cwd = resolve(options.cwd ?? process.cwd());
  const discovered = options.configPath
    ? { path: resolve(cwd, options.configPath), warnings: [] }
    : discoverConfigFile(cwd);
  const configPath = discovered.path ?? join(cwd, "variants.yaml");
  const configExists = existsSync(configPath);
  const read: ReadConfig = configExists ? readConfigFile(configPath) : { data: {}, warnings: [], migrations: [] };
  const config = read.data;
  const configDir = dirname(configPath);
  const environment = memoize(options.environment ?? (() => process.env));
  const detected = memoize(() => detectConnection(configDir, environment));
  const env = options.env ?? process.env;
  const variant = resolveVariant(config, configDir, env, environment);
  const { runtime, migrations } = readRuntimeState(configDir, env, Object.keys(variant.watches));

  const resolved = {
    ...config,
    variant,
    ...(runtime ? { runtime } : {}),
    configPath,
    configDir,
    warnings: [...discovered.warnings, ...read.warnings],
    migrations: [...read.migrations, ...migrations],
  };
  // The database and its source are read lazily: detecting them is what asks the environment provider.
  // `environment` is a function and stays out of enumeration so a resolved configuration still prints and clones.
  Object.defineProperties(resolved, {
    environment: { enumerable: false, configurable: true, value: environment },
    db: {
      enumerable: true,
      configurable: true,
      get: memoize(() =>
        expandDb(mergeDbConfig(config.db?.dialect === "sqlite" ? {} : detected().config, config.db), environment),
      ),
    },
    source: {
      enumerable: true,
      configurable: true,
      get: () => (config.db ? "config" : detected().source),
    },
    origins: {
      enumerable: false,
      configurable: true,
      get: memoize(() => {
        const origins = originsFromRaw(config, configFileOrigin(cwd, configPath));
        applyTemplateOrigins(origins, config, environment());
        fillDefaultOrigins(origins, variant.watches);
        if (config.db?.dialect !== "sqlite") {
          fillDbOrigins(origins, detected(), environment());
        }
        fillGapOrigins(origins, variant, "variant");
        fillGapOrigins(origins, configPath, "configPath");
        fillGapOrigins(origins, configDir, "configDir");
        fillGapOrigins(origins, resolved.warnings, "warnings");
        fillGapOrigins(origins, resolved.migrations, "migrations");
        if (runtime) {
          fillGapOrigins(origins, runtime, "runtime");
        }
        if (origins.source === undefined) {
          origins.source = "# autodetect connection";
        }
        return origins;
      }),
    },
  });
  return resolved as ResolvedConfig;
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
  detectScriptWatches,
  detectVariantMain,
  detectVariantRoot,
  detectWatches,
  detectWatchesForInit,
  type EnvironmentProvider,
  type OnboardingApplication,
} from "./autodetect.js";
export { amendDotenv, dotenvFor, parseDotenv } from "./dotenv.js";
export {
  addSchemaHeader,
  findSchemaHeader,
  isSchemaHeaderNotice,
  SCHEMA_HEADER_NOTICE,
  schemaHeaderFor,
  schemaHeaderNotice,
} from "./header.js";
export { type RenderedInitConfig, type RenderInitConfigOptions, renderInitConfig } from "./init-config.js";
export { type Migrated, migrateLegacy, migrateText } from "./legacy.js";
export type { DiscoveredRuntime, LocalState, ReadRuntimesOptions, RuntimeReadError } from "./local.js";
export { clearRuntime, readRuntime, readRuntimeState, readRuntimes, writeRuntime } from "./local.js";
export { type MigrationResult, migrateFile } from "./migrate-file.js";
export { miseSearchPlaces, type ResolveMiseOptions, resolveMiseBinary } from "./mise-binary.js";
export {
  groupDatabaseSchemas,
  groupMultiSchemas,
  groupOrphanSchemas,
  multiLikePattern,
  multiSchemaHead,
  multiSchemaName,
  parseMultiList,
} from "./multi.js";
export { configOrigins } from "./origins.js";
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
  WatchOutputMode,
} from "./schema.js";
export {
  DEFAULT_PORT_RANGE,
  DEFAULT_PREFIX,
  DEFAULT_URL,
  envSegment,
  LOCAL_FILENAME,
  RUNTIME_FILE,
  STATE_FILE,
  UI_PORT_ENV,
  UI_WATCH_KEY,
  VariantsConfigSchema,
  VariantsLocalSchema,
  variantsJsonSchema,
  variantsLocalJsonSchema,
} from "./schema.js";
export { formatLocalStamp, parseLocalStamp } from "./stamp.js";
export { renderTemplate, type TemplateContext } from "./template.js";
export { resolveMainVscodeDir } from "./vscode-dir.js";
export type { ChatRenamerConfig };
