import { realpathSync } from "node:fs";
import { join } from "node:path";
import {
  envSegment,
  pickFreePort,
  type ResolvedConfig,
  renderTemplate,
  type TemplateContext,
  type VariantInstance,
} from "variant-config";
import type { OperationContext } from "./operations/types.js";
import { readVariantRuntime } from "./runtime-state.js";
import { primaryWorktree } from "./worktree.js";

/** Everything the commands of one variant run need to know: where it lives and which ports its instances use. */
export interface VariantRun {
  slug: string;
  /** The database target: the variant's schema or database file. */
  target: string;
  worktree: string;
  /** Whether `worktree` is the primary checkout. */
  isPrimary: boolean;
  primary: string;
  /** The assigned port of every instance, by key. */
  ports: Record<string, number>;
  /** The rendered `open` URL of every instance that has a template, by key. */
  urls: Record<string, string>;
  /** The absolute storage directory, when `variant.storage` is configured. */
  storage?: string;
}

const realpathOrSelf = (path: string): string => {
  try {
    return realpathSync(path);
  } catch {
    return path;
  }
};

const primaryOf = (cwd: string, worktree: string): string => {
  try {
    return realpathOrSelf(primaryWorktree(cwd));
  } catch {
    return realpathOrSelf(worktree);
  }
};

/** Fails when two instances are given the same port through `VARIANT_<KEY>_PORT`, naming both variables. */
const assertDistinctOverrides = (keys: string[], env: NodeJS.ProcessEnv = process.env): void => {
  const seen = new Map<string, string>();
  for (const key of keys) {
    const name = `VARIANT_${envSegment(key)}_PORT`;
    const value = env[name];
    if (!value) {
      continue;
    }
    const other = seen.get(value);
    if (other) {
      throw new Error(`${other} and ${name} are both ${value}: every instance needs its own port`);
    }
    seen.set(value, name);
  }
};

/** Assigns a port to every instance that has none in `ports` and renders the instance URLs. */
export const prepareRun = async (
  context: OperationContext,
  slug: string,
  worktree: string,
  assigned: Readonly<Record<string, number>> = {},
): Promise<VariantRun> => {
  const { config } = context;
  const target = slug === "main" ? (config.db.schema ?? "public") : context.adapter.target(slug);
  const recorded = readVariantRuntime(config, worktree);
  assertDistinctOverrides(Object.keys(config.variant.instances));
  const ports: Record<string, number> = {};
  for (const key of Object.keys(config.variant.instances)) {
    ports[key] =
      assigned[key] ??
      recorded?.instances?.[key]?.port ??
      (await pickFreePort([...config.variant.reservedPorts, ...Object.values(ports)]));
  }
  const storage = config.variant.storage ? join(worktree, config.variant.storage.dir) : undefined;
  const primary = primaryOf(context.cwd, worktree);
  const run: VariantRun = {
    slug,
    target,
    worktree,
    isPrimary: realpathOrSelf(worktree) === primary,
    primary,
    ports,
    urls: {},
    ...(storage ? { storage } : {}),
  };
  for (const [key, instance] of Object.entries(config.variant.instances)) {
    if (instance.open !== undefined) {
      run.urls[key] = renderTemplate(instance.open, templateContext(run, key));
    }
  }
  return run;
};

/** The template values of an instance (`key`), or of a step or variant-wide command (no `key`). */
export const templateContext = (run: VariantRun, key?: string): TemplateContext => ({
  slug: run.slug,
  schema: run.target,
  storage: run.storage ?? "",
  worktree: run.worktree,
  url: key === undefined ? "" : (run.urls[key] ?? ""),
  port: key === undefined ? "" : (run.ports[key] ?? ""),
  ports: run.ports,
});

/** `env` of a step or instance with its templates expanded. */
export const expandEnv = (
  values: Readonly<Record<string, string>> | undefined,
  run: VariantRun,
  key?: string,
): Record<string, string> =>
  Object.fromEntries(
    Object.entries(values ?? {}).map(([name, value]) => [name, renderTemplate(value, templateContext(run, key))]),
  );

interface DatabaseSettings {
  host?: string;
  port?: string;
  user?: string;
  password?: string;
  database?: string;
}

/** The connection settings of `db`: explicit fields, completed from `url`. */
const databaseSettings = (db: ResolvedConfig["db"]): DatabaseSettings => {
  const url = db.url && URL.canParse(db.url) ? new URL(db.url) : undefined;
  const pick = (explicit: string | number | undefined, fromUrl: string | undefined): string | undefined =>
    explicit !== undefined ? String(explicit) : fromUrl || undefined;
  return {
    host: pick(db.host, url?.hostname),
    port: pick(db.port, url?.port),
    user: pick(db.user, url ? decodeURIComponent(url.username) : undefined),
    password: pick(db.password, url ? decodeURIComponent(url.password) : undefined),
    database: pick(db.database, url ? decodeURIComponent(url.pathname.slice(1)) : undefined),
  };
};

const defined = (entries: Record<string, string | undefined>): Record<string, string> =>
  Object.fromEntries(Object.entries(entries).filter((entry): entry is [string, string] => entry[1] !== undefined));

/**
 * The variables of a variant that every command sees on top of the process environment: the variant, its database
 * target and connection settings, the storage directory and the port and URL of every instance. A container reaches the
 * host database under its own name, so it keeps `host.docker.internal`; commands on the host get `127.0.0.1`.
 */
export const variantVariables = (
  config: ResolvedConfig,
  run: VariantRun,
  where: "host" | "container" = "host",
): Record<string, string> => {
  const settings = databaseSettings(config.db);
  const host = where === "host" && settings.host === "host.docker.internal" ? "127.0.0.1" : settings.host;
  const variables: Record<string, string | undefined> = {
    VARIANT_SLUG: run.slug,
    VARIANT_TARGET: run.target,
    VARIANT_CONFIG: config.configPath,
  };
  const prefix = config.db.dialect === "postgres" ? "POSTGRES" : config.db.dialect === "mysql" ? "MYSQL" : undefined;
  if (prefix) {
    variables[`${prefix}_HOST`] = host;
    variables[`${prefix}_PORT`] = settings.port;
    variables[`${prefix}_USER`] = settings.user;
    variables[`${prefix}_PASSWORD`] = settings.password;
    variables[prefix === "POSTGRES" ? "POSTGRES_DB" : "MYSQL_DATABASE"] = settings.database;
    variables[`${prefix}_SCHEMA`] = run.target;
  } else if (config.db.dialect === "sqlite") {
    variables.SQLITE_DATABASE = run.target;
  }
  if (run.storage && config.variant.storage) {
    variables[config.variant.storage.env] = run.storage;
  }
  for (const key of Object.keys(config.variant.instances)) {
    const segment = envSegment(key);
    variables[`VARIANT_${segment}_PORT`] = String(run.ports[key]);
    variables[`VARIANT_${segment}_URL`] = run.urls[key];
  }
  return defined(variables);
};

/** The environment of a host command: the process, the variant, then the expanded `env` of the step or instance. */
export const commandEnvironment = (
  config: ResolvedConfig,
  run: VariantRun,
  env: Readonly<Record<string, string>> | undefined,
  instanceKey?: string,
): NodeJS.ProcessEnv => ({
  ...process.env,
  ...variantVariables(config, run),
  ...expandEnv(env, run, instanceKey),
});

export type { VariantInstance };
