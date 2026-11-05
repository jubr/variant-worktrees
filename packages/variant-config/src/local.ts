import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { migrateLegacy } from "./legacy.js";
import {
  envSegment,
  LOCAL_FILENAME,
  type ResolvedRuntime,
  RUNTIME_FILE,
  type Runtime,
  type RuntimeWatch,
  STATE_FILE,
  type StateFile,
  StateFileSchema,
  VariantsLocalSchema,
} from "./schema.js";

const TEMPLATE = /\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g;

/** Replaces `${NAME}` in every string with the environment variable `NAME`; an unset variable leaves the template. */
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

const readLegacy = (configDir: string, env: NodeJS.ProcessEnv): LocalState => {
  const path = join(configDir, LOCAL_FILENAME);
  if (!existsSync(path)) {
    return { migrations: [] };
  }
  const { data, notices } = migrateLegacy(parseYaml(readFileSync(path, "utf8")) ?? {}, path);
  const local = VariantsLocalSchema.parse(expandEnv(data, env));
  return { ...(local.runtime ? { runtime: resolveRuntime(local.runtime) } : {}), migrations: notices };
};

const dbFromState = (state: StateFile): ResolvedRuntime["db"] => {
  if (state.dialect === undefined && state.target === undefined) {
    return undefined;
  }
  if (state.dialect === "sqlite") {
    return {
      ...(state.dialect ? { dialect: state.dialect } : {}),
      ...(state.target ? { filename: state.target } : {}),
    };
  }
  return {
    ...(state.dialect ? { dialect: state.dialect } : {}),
    ...(state.target ? { schema: state.target } : {}),
  };
};

const runtimeFromState = (state: StateFile): ResolvedRuntime => {
  const db = dbFromState(state);
  return {
    ...(state.slug ? { slug: state.slug } : {}),
    ...(state.mode ? { mode: state.mode } : {}),
    ...(state.dir ? { dir: state.dir } : {}),
    ...(state.log ? { log: state.log } : {}),
    ...(state.createdAt ? { createdAt: state.createdAt } : {}),
    ...(db ? { db } : {}),
    ...(state.watches ? { watches: state.watches } : {}),
  };
};

/** Reads `.cache/variant/state.yaml`. Absent file is `undefined`. An unknown key fails validation. */
const readStateFile = (configDir: string): StateFile | undefined => {
  const path = join(configDir, STATE_FILE);
  if (!existsSync(path)) {
    return undefined;
  }
  return StateFileSchema.parse(parseYaml(readFileSync(path, "utf8")) ?? {});
};

const readDumpDb = (configDir: string): ResolvedRuntime["db"] => {
  const path = join(configDir, RUNTIME_FILE);
  if (!existsSync(path)) {
    return undefined;
  }
  try {
    const dump = parseYaml(readFileSync(path, "utf8")) as { db?: ResolvedRuntime["db"] } | null;
    return dump?.db;
  } catch {
    return undefined;
  }
};

const readLocal = (configDir: string, env: NodeJS.ProcessEnv): LocalState => {
  const state = readStateFile(configDir);
  if (!state) {
    return readLegacy(configDir, env);
  }
  const runtime = runtimeFromState(state);
  const dumped = readDumpDb(configDir);
  if (dumped) {
    runtime.db = { ...runtime.db, ...dumped };
  }
  return { runtime, migrations: [] };
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

const writeIfChanged = (path: string, text: string): void => {
  if (existsSync(path) && readFileSync(path, "utf8") === text) {
    return;
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
};

const targetOf = (db: Runtime["db"]): string | undefined => db?.schema ?? db?.filename;

const watchFacts = (watches: Runtime["watches"]): StateFile["watches"] =>
  Object.fromEntries(
    Object.entries(watches ?? {}).map(([key, watch]) => [
      key,
      {
        ...(watch.port !== undefined ? { port: watch.port } : {}),
        ...(watch.pid !== undefined ? { pid: watch.pid } : {}),
        ...(watch.url !== undefined ? { url: watch.url } : {}),
        ...(watch.startedAt !== undefined ? { startedAt: watch.startedAt } : {}),
      },
    ]),
  );

const stateFromRuntime = (runtime: Runtime): StateFile => {
  const target = targetOf(runtime.db);
  return StateFileSchema.parse({
    ...(runtime.slug ? { slug: runtime.slug } : {}),
    ...(runtime.createdAt ? { createdAt: runtime.createdAt } : {}),
    ...(runtime.dir ? { dir: runtime.dir } : {}),
    ...(runtime.db?.dialect ? { dialect: runtime.db.dialect } : {}),
    ...(target ? { target } : {}),
    ...(runtime.mode ? { mode: runtime.mode } : {}),
    ...(runtime.log ? { log: runtime.log } : {}),
    ...(runtime.watches ? { watches: watchFacts(runtime.watches) } : {}),
  });
};

const configPathOf = (configDir: string): string | undefined =>
  ["variants.yaml", "variants.yml"].map((name) => join(configDir, name)).find((path) => existsSync(path));

/**
 * Writes `.cache/variant/state.yaml` and `.cache/variant/runtime.yaml`.
 * Skips a file whose text would not change. Does not create or rewrite `variants.local.yaml`.
 * Specification: openspec/specs/variant-config/core/spec.md
 */
export const writeRuntime = (configDir: string, runtime: Runtime): void => {
  const state = stateFromRuntime(runtime);
  const configPath = configPathOf(configDir);
  const dump = {
    ...(runtime.db ? { db: runtime.db } : {}),
    ...(runtime.watches ? { watches: watchFacts(runtime.watches) } : {}),
    ...(configPath ? { configPath } : {}),
  };
  writeIfChanged(join(configDir, STATE_FILE), stringifyYaml(state));
  writeIfChanged(join(configDir, RUNTIME_FILE), stringifyYaml(dump));
};

const withoutOperation = (state: StateFile): StateFile => {
  const { mode: _mode, log: _log, watches: _watches, ...kept } = state;
  return kept;
};

/**
 * Clears `mode`, `log` and `watches` from the state file and the process facts from the dump.
 * Keeps identity fields. Does not create or rewrite `variants.local.yaml`.
 */
export const clearRuntime = (configDir: string): void => {
  const statePath = join(configDir, STATE_FILE);
  const dumpPath = join(configDir, RUNTIME_FILE);
  const state = readStateFile(configDir) ?? stateFromRuntime(readLegacy(configDir, {}).runtime ?? {});
  const kept = withoutOperation(state);
  if (Object.keys(kept).length === 0) {
    rmSync(statePath, { force: true });
    rmSync(dumpPath, { force: true });
    return;
  }
  writeIfChanged(statePath, stringifyYaml(kept));
  if (existsSync(dumpPath)) {
    try {
      const dump = (parseYaml(readFileSync(dumpPath, "utf8")) ?? {}) as Record<string, unknown>;
      delete dump.watches;
      writeIfChanged(dumpPath, stringifyYaml(dump));
    } catch {
      rmSync(dumpPath, { force: true });
    }
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
