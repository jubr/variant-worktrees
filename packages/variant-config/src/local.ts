import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { LOCAL_FILENAME, type ResolvedRuntime, type Runtime, RuntimeSchema, VariantsLocalSchema } from "./schema.js";

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

/**
 * The `runtime` section of `<configDir>/variants.local.yaml`, with environment templates replaced. Nothing when the file
 * or section is missing; throws when the file is invalid.
 */
export const readRuntime = (configDir: string, env: NodeJS.ProcessEnv = process.env): ResolvedRuntime | undefined => {
  const path = join(configDir, LOCAL_FILENAME);
  if (!existsSync(path)) {
    return undefined;
  }
  const parsed: unknown = parseYaml(readFileSync(path, "utf8"));
  const local = VariantsLocalSchema.parse(expandEnv(parsed ?? {}, env));
  return local.runtime ? resolveRuntime(local.runtime) : undefined;
};

/** Writes the `runtime` section of `<configDir>/variants.local.yaml`, validated, keeping the file's other top-level keys. */
export const writeRuntime = (configDir: string, runtime: Runtime): void => {
  const path = join(configDir, LOCAL_FILENAME);
  const existing: unknown = existsSync(path) ? parseYaml(readFileSync(path, "utf8")) : {};
  const others = typeof existing === "object" && existing !== null ? existing : {};
  writeFileSync(path, stringifyYaml({ ...others, runtime: RuntimeSchema.parse(runtime) }));
};
