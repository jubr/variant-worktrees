import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { findSchemaHeader, schemaHeaderFor } from "./header.js";
import { migrateLegacy } from "./legacy.js";
import {
  envSegment,
  LOCAL_FILENAME,
  type ResolvedRuntime,
  type Runtime,
  RuntimeSchema,
  type RuntimeWatch,
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

export interface LocalState {
  runtime?: ResolvedRuntime;
  /** Notices of names of an earlier version that were read under the current ones. */
  migrations: string[];
}

const readLocal = (configDir: string, env: NodeJS.ProcessEnv): LocalState => {
  const path = join(configDir, LOCAL_FILENAME);
  if (!existsSync(path)) {
    return { migrations: [] };
  }
  const { data, notices } = migrateLegacy(parseYaml(readFileSync(path, "utf8")) ?? {}, path);
  const local = VariantsLocalSchema.parse(expandEnv(data, env));
  return { ...(local.runtime ? { runtime: resolveRuntime(local.runtime) } : {}), migrations: notices };
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

/** The `VARIANT_<KEY>_PORT`, `_URL` and `_PID` variables of one watch. An empty variable counts as unset. */
const watchOverrides = (key: string, env: NodeJS.ProcessEnv): RuntimeWatch => {
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
 * The `runtime` section of `<configDir>/variants.local.yaml`, with environment templates replaced. For each watch key
 * in `watchKeys` the variables `VARIANT_<KEY>_PORT`, `_URL` and `_PID` win over the file, which makes a runtime state
 * even when there is no file. Nothing when there is neither; throws when the file or an override is invalid.
 */
export const readRuntime = (
  configDir: string,
  env: NodeJS.ProcessEnv = process.env,
  watchKeys: readonly string[] = [],
): ResolvedRuntime | undefined => readRuntimeState(configDir, env, watchKeys).runtime;

/** `readRuntime` with the notices of the names of an earlier version that were read under the current ones. */
export const readRuntimeState = (
  configDir: string,
  env: NodeJS.ProcessEnv = process.env,
  watchKeys: readonly string[] = [],
): LocalState => {
  const { runtime, migrations } = readLocal(configDir, env);
  const overrides = Object.fromEntries(
    watchKeys
      .map((key) => [key, watchOverrides(key, env)] as const)
      .filter(([, override]) => Object.keys(override).length > 0),
  );
  if (Object.keys(overrides).length === 0) {
    return { ...(runtime ? { runtime } : {}), migrations };
  }
  const watches = { ...runtime?.watches };
  for (const [key, override] of Object.entries(overrides)) {
    watches[key] = { ...watches[key], ...override };
  }
  return { runtime: { ...runtime, watches }, migrations };
};

/** Writes the `runtime` section of `<configDir>/variants.local.yaml`, validated, keeping the file's other top-level keys. */
export const writeRuntime = (configDir: string, runtime: Runtime): void => {
  const path = join(configDir, LOCAL_FILENAME);
  const text = existsSync(path) ? readFileSync(path, "utf8") : "";
  const existing: unknown = text === "" ? {} : parseYaml(text);
  const others = typeof existing === "object" && existing !== null ? existing : {};
  const header = findSchemaHeader(text) ?? schemaHeaderFor(LOCAL_FILENAME);
  writeFileSync(path, `${header}\n\n${stringifyYaml({ ...others, runtime: RuntimeSchema.parse(runtime) })}`);
};

/** Removes the `runtime` section of `<configDir>/variants.local.yaml`, keeping other keys; a file left empty is removed. */
export const clearRuntime = (configDir: string): void => {
  const path = join(configDir, LOCAL_FILENAME);
  if (!existsSync(path)) {
    return;
  }
  const text = readFileSync(path, "utf8");
  const existing: unknown = parseYaml(text);
  const { runtime: _removed, ...others } =
    typeof existing === "object" && existing !== null ? (existing as Record<string, unknown>) : {};
  if (Object.keys(others).length === 0) {
    rmSync(path);
  } else {
    const header = findSchemaHeader(text);
    writeFileSync(path, `${header === undefined ? "" : `${header}\n\n`}${stringifyYaml(others)}`);
  }
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
      const { runtime } = readLocal(dir, env);
      if (runtime) {
        states.push({ dir, runtime });
      }
    } catch (error) {
      errors.push({ dir, message: error instanceof Error ? error.message : String(error) });
    }
  }
  return { states, errors };
};
