import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import { detectConnection, detectInstances } from "./autodetect.js";
import type { DbConfig, ResolvedConfig, VariantInstance, VariantsConfig } from "./schema.js";
import { VariantsConfigSchema, variantsJsonSchema } from "./schema.js";

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
  config.variants?.[slug]?.seed ?? config.seed;

export const runtimeCommandFor = (
  config: ResolvedConfig,
  kind: "up" | "watch",
  instance?: VariantInstance,
): string | undefined => instance?.[kind] ?? config.variant?.[kind];

export const writeJsonSchema = (): string => JSON.stringify(variantsJsonSchema, null, 2);

export { detectConnection, detectInstances, findMiseFile } from "./autodetect.js";
export type {
  DbConfig,
  DbDialect,
  ResolvedConfig,
  VariantEntry,
  VariantInstance,
  VariantRuntime,
  VariantsConfig,
} from "./schema.js";
export { VariantsConfigSchema, variantsJsonSchema } from "./schema.js";
