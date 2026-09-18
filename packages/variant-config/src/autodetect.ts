import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, parse as parsePath, relative, resolve } from "node:path";
import { parse as parseToml } from "smol-toml";
import type { DbConfig, DbDialect, VariantInstance } from "./schema.js";

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

const shouldSkip = (name: string): boolean =>
  name === "node_modules" ||
  name === ".git" ||
  name === ".cache" ||
  name === "dist" ||
  name === "build" ||
  name.startsWith(".");

export const detectInstances = (configDir: string): VariantInstance[] => {
  const result: VariantInstance[] = [];
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
        result.push({ kind, dir: relative(configDir, child) || "." });
      }
      walk(child);
    }
  };

  if (existsSync(configDir) && statSync(configDir).isDirectory()) {
    walk(configDir);
  }
  return result.sort((left, right) => left.dir.localeCompare(right.dir));
};

export const inferConfigRoot = (path: string): string => parsePath(resolve(path)).dir;
