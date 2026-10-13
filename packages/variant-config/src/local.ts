import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import {
  envSegment,
  LOCAL_FILENAME,
  type ResolvedRuntime,
  type Runtime,
  type RuntimeInstance,
  RuntimeSchema,
  VariantsLocalSchema,
} from "./schema.js";

const TEMPLATE = /\{\{([A-Za-z_][A-Za-z0-9_]*)\}\}/g;

/** Replaces `{{NAME}}` in every string with the environment variable `NAME`; an unset variable leaves the template. */
const expandEnv = (value: unknown, env: NodeJS.ProcessEnv): unknown => {
  if (typeof value === "string") {
    return value.replace(TEMPLATE, (template, name: string) => env[name] ?? template);
  }
  if (Array.isArray(value)) {
    return value.map((item) => expandEnv(item, env));
  }
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, expandEnv(item, env)]));
  }
  return value;
};

const resolveRuntime = (runtime: Runtime): ResolvedRuntime => {
  const { db, ...rest } = runtime;
  if (!db) {
    return rest;
  }
  const { port, ...dbRest } = db;
  const numeric = typeof port === "string" ? (/^\d+$/.test(port) ? Number(port) : undefined) : port;
  return { ...rest, db: numeric === undefined ? dbRest : { ...dbRest, port: numeric } };
};

const readLocal = (configDir: string, env: NodeJS.ProcessEnv): ResolvedRuntime | undefined => {
  const path = join(configDir, LOCAL_FILENAME);
  if (!existsSync(path)) {
    return undefined;
  }
  const parsed: unknown = parseYaml(readFileSync(path, "utf8"));
  const local = VariantsLocalSchema.parse(expandEnv(parsed ?? {}, env));
  return local.runtime ? resolveRuntime(local.runtime) : undefined;
};

const positiveInteger = (name: string, value: string): number => {
  const number = Number(value);
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(number) || number <= 0) {
    throw new Error(`${name} must be a positive integer, got "${value}"`);
  }
  return number;
};

const absoluteUrl = (name: string, value: string): string => {
  if (!URL.canParse(value)) {
    throw new Error(`${name} must be an absolute URL, got "${value}"`);
  }
  return value;
};

/** The `VARIANT_<KEY>_PORT`, `_URL` and `_PID` variables of one instance. An empty variable counts as unset. */
const instanceOverrides = (key: string, env: NodeJS.ProcessEnv): RuntimeInstance => {
  const segment = envSegment(key);
  const read = (suffix: "PORT" | "URL" | "PID"): [string, string] | undefined => {
    const name = `VARIANT_${segment}_${suffix}`;
    const value = env[name];
    return value === undefined || value === "" ? undefined : [name, value];
  };
  const port = read("PORT");
  const url = read("URL");
  const pid = read("PID");
  return {
    ...(port ? { port: positiveInteger(...port) } : {}),
    ...(pid ? { pid: positiveInteger(...pid) } : {}),
    ...(url ? { url: absoluteUrl(...url) } : {}),
  };
};

/**
 * The `runtime` section of `<configDir>/variants.local.yaml`, with environment templates replaced. For each instance key
 * in `instanceKeys` the variables `VARIANT_<KEY>_PORT`, `_URL` and `_PID` win over the file, which makes a runtime state
 * even when there is no file. Nothing when there is neither; throws when the file or an override is invalid.
 */
export const readRuntime = (
  configDir: string,
  env: NodeJS.ProcessEnv = process.env,
  instanceKeys: readonly string[] = [],
): ResolvedRuntime | undefined => {
  const runtime = readLocal(configDir, env);
  const overrides = Object.fromEntries(
    instanceKeys
      .map((key) => [key, instanceOverrides(key, env)] as const)
      .filter(([, override]) => Object.keys(override).length > 0),
  );
  if (Object.keys(overrides).length === 0) {
    return runtime;
  }
  const instances = { ...runtime?.instances };
  for (const [key, override] of Object.entries(overrides)) {
    instances[key] = { ...instances[key], ...override };
  }
  return { ...runtime, instances };
};

/** Writes the `runtime` section of `<configDir>/variants.local.yaml`, validated, keeping the file's other top-level keys. */
export const writeRuntime = (configDir: string, runtime: Runtime): void => {
  const path = join(configDir, LOCAL_FILENAME);
  const existing: unknown = existsSync(path) ? parseYaml(readFileSync(path, "utf8")) : {};
  const others = typeof existing === "object" && existing !== null ? existing : {};
  writeFileSync(path, stringifyYaml({ ...others, runtime: RuntimeSchema.parse(runtime) }));
};

export interface ReadRuntimesOptions {
  /** The resolved variant root. */
  root: string;
  /** The resolved `variant.prefix`. */
  prefix: string;
  /** The directory of the primary git worktree. */
  main: string;
  env?: NodeJS.ProcessEnv;
}

export interface DiscoveredRuntime {
  dir: string;
  runtime: ResolvedRuntime;
}

export interface RuntimeReadError {
  dir: string;
  message: string;
}

/**
 * The local runtime states of a workspace: exactly `<root>/<prefix>*\/variants.local.yaml` and
 * `<main>/variants.local.yaml`, nothing deeper. A file without a `runtime` section is left out; an invalid file is
 * reported by directory and does not fail the search. `VARIANT_*` overrides are not applied: they describe only the
 * variant that is being run.
 */
export const readRuntimes = (
  options: ReadRuntimesOptions,
): { states: DiscoveredRuntime[]; errors: RuntimeReadError[] } => {
  const env = options.env ?? process.env;
  const prefixed = existsSync(options.root)
    ? readdirSync(options.root, { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && entry.name.startsWith(options.prefix))
        .map((entry) => join(options.root, entry.name))
        .sort()
    : [];
  const directories = [...new Set([...prefixed, options.main])];
  const states: DiscoveredRuntime[] = [];
  const errors: RuntimeReadError[] = [];
  for (const dir of directories) {
    try {
      const runtime = readLocal(dir, env);
      if (runtime) {
        states.push({ dir, runtime });
      }
    } catch (error) {
      errors.push({ dir, message: error instanceof Error ? error.message : String(error) });
    }
  }
  return { states, errors };
};
