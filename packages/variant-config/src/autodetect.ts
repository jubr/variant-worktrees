import { execFileSync } from "node:child_process";
import { existsSync, lstatSync, readdirSync, readFileSync, realpathSync, statSync } from "node:fs";
import { basename, dirname, join, parse as parsePath, relative, resolve } from "node:path";
import { parse as parseToml } from "smol-toml";
import { type DbConfig, type DbDialect, DEFAULT_OPEN_URL, INSTANCE_KEY, type VariantInstance } from "./schema.js";

const MISE_FILENAMES = ["mise.local.toml", "mise.toml"] as const;
const ENV_KEYS = [
  "DATABASE_URL",
  "POSTGRES_HOST",
  "POSTGRES_PORT",
  "POSTGRES_USER",
  "POSTGRES_PASSWORD",
  "POSTGRES_DB",
  "POSTGRES_SCHEMA",
  "POSTGRES_SSL",
  "MYSQL_HOST",
  "MYSQL_PORT",
  "MYSQL_USER",
  "MYSQL_PASSWORD",
  "MYSQL_DATABASE",
  "MYSQL_SCHEMA",
  "SQLITE_DATABASE",
  "SQLITE_PATH",
] as const;

type Environment = Record<string, string | undefined>;
type TomlDocument = { env?: Record<string, unknown> };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const parseBoolean = (value: string | undefined): boolean | undefined => {
  if (value === undefined) {
    return undefined;
  }
  if (value === "true" || value === "1") {
    return true;
  }
  if (value === "false" || value === "0") {
    return false;
  }
  return undefined;
};

const parsePort = (value: string | undefined): number | undefined => {
  if (value === undefined || value === "") {
    return undefined;
  }
  const port = Number(value);
  return Number.isInteger(port) && port > 0 ? port : undefined;
};

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

export const findMiseFile = (startDir = process.cwd()): string | undefined => {
  for (const directory of ancestorDirectories(startDir)) {
    for (const filename of MISE_FILENAMES) {
      const path = join(directory, filename);
      if (existsSync(path)) {
        return path;
      }
    }
  }
  return undefined;
};

const gitCommonRoot = (startDir: string): string | undefined => {
  try {
    const commonDir = execFileSync("git", ["-C", resolve(startDir), "rev-parse", "--git-common-dir"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    return realpathSync(dirname(resolve(startDir, commonDir)));
  } catch {
    return undefined;
  }
};

export const detectVariantRoot = (configDir: string): string => {
  const parentAgents = join(dirname(resolve(configDir)), "AGENTS.md");
  try {
    if (lstatSync(parentAgents).isSymbolicLink()) {
      return dirname(realpathSync(parentAgents));
    }
  } catch {
    // Continue with git metadata fallback.
  }

  const commonRoot = gitCommonRoot(configDir);
  if (commonRoot) {
    const realAgents = join(commonRoot, "AGENTS.md");
    if (existsSync(realAgents)) {
      return dirname(resolve(realAgents));
    }
    return realpathSync(commonRoot);
  }
  return realpathSync(resolve(configDir));
};

const readMiseEnvironment = (path: string): Environment => {
  const parsed = parseToml(readFileSync(path, "utf8")) as TomlDocument;
  const env = isRecord(parsed.env) ? parsed.env : {};
  const result: Environment = {};
  for (const key of ENV_KEYS) {
    const value = env[key];
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      result[key] = String(value);
    }
  }
  return result;
};

const choose = (primary: Environment, fallback: Environment, key: string): string | undefined =>
  primary[key] ?? fallback[key];

const detectDialect = (values: Environment): DbDialect | undefined => {
  if (values.DATABASE_URL?.startsWith("postgres")) {
    return "postgres";
  }
  if (values.DATABASE_URL?.startsWith("mysql")) {
    return "mysql";
  }
  if (values.DATABASE_URL?.startsWith("sqlite")) {
    return "sqlite";
  }
  if (values.POSTGRES_HOST || values.POSTGRES_DB || values.POSTGRES_USER) {
    return "postgres";
  }
  if (values.MYSQL_HOST || values.MYSQL_DATABASE || values.MYSQL_USER) {
    return "mysql";
  }
  if (values.SQLITE_DATABASE || values.SQLITE_PATH) {
    return "sqlite";
  }
  return undefined;
};

export interface DetectedConnection {
  config: DbConfig;
  source: "mise" | "env" | "default";
  misePath?: string;
}

export const detectConnection = (startDir = process.cwd()): DetectedConnection => {
  const misePath = findMiseFile(startDir);
  const miseEnvironment = misePath ? readMiseEnvironment(misePath) : {};
  const processEnvironment = process.env;
  const values: Environment = {};
  for (const key of ENV_KEYS) {
    values[key] = choose(miseEnvironment, processEnvironment, key);
  }

  const dialect = detectDialect(values);
  if (!dialect) {
    return {
      config: {
        dialect: "sqlite",
        filename: join(startDir, ".cache", "variants", "variants.db"),
      },
      source: "default",
      misePath,
    };
  }

  const source = misePath && detectDialect(miseEnvironment) ? "mise" : "env";
  const config: DbConfig = {
    dialect,
    url: values.DATABASE_URL,
    host: values.POSTGRES_HOST ?? values.MYSQL_HOST,
    port: parsePort(values.POSTGRES_PORT ?? values.MYSQL_PORT),
    user: values.POSTGRES_USER ?? values.MYSQL_USER,
    password: values.POSTGRES_PASSWORD ?? values.MYSQL_PASSWORD,
    database: values.POSTGRES_DB ?? values.MYSQL_DATABASE ?? values.SQLITE_DATABASE,
    schema: values.POSTGRES_SCHEMA ?? values.MYSQL_SCHEMA,
    filename: values.SQLITE_PATH,
    ssl: parseBoolean(values.POSTGRES_SSL),
  };

  return { config, source, misePath };
};

const packageDeclares = (path: string, dependency: string): boolean => {
  const packagePath = join(path, "package.json");
  if (!existsSync(packagePath)) {
    return false;
  }
  try {
    const packageJson = JSON.parse(readFileSync(packagePath, "utf8")) as Record<string, unknown>;
    for (const field of ["dependencies", "devDependencies", "peerDependencies"]) {
      const dependencies = packageJson[field];
      if (isRecord(dependencies) && dependency in dependencies) {
        return true;
      }
    }
  } catch {
    return false;
  }
  return false;
};

const detectKind = (path: string): VariantInstance["kind"] | undefined => {
  const filenames = new Set(readdirSync(path, { withFileTypes: true }).map((entry) => entry.name));
  if (
    [...filenames].some((filename) => /^vite\.config\.(js|mjs|ts|mts|cjs|cts)$/.test(filename)) ||
    packageDeclares(path, "vite")
  ) {
    return "vite";
  }
  if (filenames.has("nest-cli.json") || packageDeclares(path, "@nestjs/core")) {
    return "nestjs";
  }
  return undefined;
};

/** The scripts of the `package.json` in `path`. */
const packageScripts = (path: string): Record<string, string> => {
  try {
    const packageJson = JSON.parse(readFileSync(join(path, "package.json"), "utf8")) as Record<string, unknown>;
    const scripts = packageJson.scripts;
    return isRecord(scripts)
      ? Object.fromEntries(
          Object.entries(scripts).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
        )
      : {};
  } catch {
    return {};
  }
};

/** Whether the first Vite config file in `path` sets `clearScreen`, which then owns the behavior. */
const viteConfigSetsClearScreen = (path: string): boolean =>
  readdirSync(path)
    .filter((name) => /^vite\.config\.(js|mjs|ts|mts|cjs|cts)$/.test(name))
    .some((name) => /\bclearScreen\s*:/.test(readFileSync(join(path, name), "utf8")));

/** Whether `tsconfig.json` in `path` sets `preserveWatchOutput`, which then owns the behavior. */
const tsconfigPreservesWatchOutput = (path: string): boolean => {
  try {
    return /"preserveWatchOutput"\s*:\s*true/.test(readFileSync(join(path, "tsconfig.json"), "utf8"));
  } catch {
    return false;
  }
};

/**
 * The command that watches an application without clearing the console, so the output of several instances stays
 * readable in one terminal. A project's own setting (`clearScreen` in the Vite config, `preserveWatchOutput` in
 * `tsconfig.json`) is left to the project; otherwise the flag is added to the command line. A `bun --watch` or
 * `--hot` script gets `--no-clear-screen` inside its own command, because flags after the file would reach the app.
 */
const detectWatch = (kind: NonNullable<VariantInstance["kind"]>, path: string): string => {
  const scripts = packageScripts(path);
  if (kind === "vite") {
    const base = scripts.dev ? "bun run dev" : "bunx --bun vite";
    return viteConfigSetsClearScreen(path) ? base : `${base} --clearScreen false`;
  }
  const script = scripts["start:dev"];
  if (script && /^bun\s+(--watch|--hot)\b/.test(script)) {
    return script.replace(/^bun\s+(--watch|--hot)\b/, "bun $1 --no-clear-screen");
  }
  const base = script ? "bun run start:dev" : "bunx nest start --watch";
  return tsconfigPreservesWatchOutput(path) ? base : `${base} --preserveWatchOutput`;
};

const shouldSkip = (name: string): boolean =>
  name === "node_modules" ||
  name === ".git" ||
  name === ".cache" ||
  name === "dist" ||
  name === "build" ||
  name.startsWith(".");

/** The key of an autodetected instance: its directory's base name, or its kind for the configuration directory. */
const instanceKeyFor = (instance: VariantInstance): string => {
  const base = instance.dir === "." ? instance.kind : basename(instance.dir);
  const plain = base.replace(/[^A-Za-z0-9_-]/g, "-");
  return INSTANCE_KEY.test(plain) ? plain : `${instance.kind}-${plain}`;
};

/** The applications below `configDir`, keyed by directory name (`web`, `web-2`, ...) and ordered by directory. */
export const detectInstances = (configDir: string): Record<string, VariantInstance> => {
  const found: VariantInstance[] = [];
  const visited = new Set<string>();
  const walk = (directory: string): void => {
    const resolved = resolve(directory);
    if (visited.has(resolved)) {
      return;
    }
    visited.add(resolved);

    for (const entry of readdirSync(resolved, { withFileTypes: true })) {
      if (!entry.isDirectory() || shouldSkip(entry.name)) {
        continue;
      }
      const child = join(resolved, entry.name);
      const kind = detectKind(child);
      if (kind) {
        const dir = relative(configDir, child) || ".";
        const watch = detectWatch(kind, child);
        found.push(kind === "vite" ? { kind, dir, open: DEFAULT_OPEN_URL, watch } : { kind, dir, watch });
      }
      walk(child);
    }
  };

  if (existsSync(configDir) && statSync(configDir).isDirectory()) {
    walk(configDir);
  }
  const instances: Record<string, VariantInstance> = {};
  for (const instance of found.sort((left, right) => left.dir.localeCompare(right.dir))) {
    const base = instanceKeyFor(instance);
    let key = base;
    for (let suffix = 2; key in instances; suffix += 1) {
      key = `${base}-${suffix}`;
    }
    instances[key] = instance;
  }
  return instances;
};

export const inferConfigRoot = (path: string): string => parsePath(resolve(path)).dir;
