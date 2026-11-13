import { execFileSync } from "node:child_process";
import { existsSync, lstatSync, readdirSync, readFileSync, realpathSync, statSync } from "node:fs";
import { basename, dirname, isAbsolute, join, parse as parsePath, relative, resolve } from "node:path";
import { type DbConfig, type DbDialect, DEFAULT_URL, type VariantWatch, WATCH_KEY } from "./schema.js";

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
  "MARIADB_HOST",
  "MARIADB_PORT",
  "MARIADB_USER",
  "MARIADB_PASSWORD",
  "MARIADB_DATABASE",
  "SQLITE_DATABASE",
  "SQLITE_PATH",
] as const;

type Environment = Record<string, string | undefined>;

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

export type VariantMainVia = "agents" | "git" | "config";

/**
 * The main tree the worktrees are made from, and which signal found it: a parent `AGENTS.md` symlink,
 * else the git carrying directory, else `configDir`.
 */
export const detectVariantPlace = (configDir: string): { main: string; via: VariantMainVia } => {
  const parentAgents = join(dirname(resolve(configDir)), "AGENTS.md");
  try {
    if (lstatSync(parentAgents).isSymbolicLink()) {
      return { main: dirname(realpathSync(parentAgents)), via: "agents" };
    }
  } catch {
    // Continue with git metadata fallback.
  }

  const commonRoot = gitCommonRoot(configDir);
  if (commonRoot) {
    const realAgents = join(commonRoot, "AGENTS.md");
    if (existsSync(realAgents)) {
      return { main: dirname(resolve(realAgents)), via: "git" };
    }
    return { main: realpathSync(commonRoot), via: "git" };
  }
  return { main: realpathSync(resolve(configDir)), via: "config" };
};

/** The main tree the worktrees are made from. */
export const detectVariantMain = (configDir: string): string => detectVariantPlace(configDir).main;

const realpathOrResolve = (path: string): string => {
  try {
    return realpathSync(path);
  } catch {
    return resolve(path);
  }
};

const isInside = (directory: string, path: string): boolean => {
  const relation = relative(directory, path);
  return relation === "" || (!relation.startsWith("..") && !isAbsolute(relation));
};

/**
 * The directory that holds the `<prefix><slug>` worktrees: the directory of a parent `AGENTS.md` symlink whose
 * target lies in `main` (`<parent>/_v-foo`), else `main` itself (`./_v-foo`).
 */
export const detectVariantRoot = (configDir: string, main: string): string => {
  const parentAgents = join(dirname(resolve(configDir)), "AGENTS.md");
  try {
    if (lstatSync(parentAgents).isSymbolicLink() && isInside(realpathOrResolve(main), realpathSync(parentAgents))) {
      return realpathSync(dirname(parentAgents));
    }
  } catch {
    // No usable symlink: the worktrees go into the main tree.
  }
  return main;
};

/** The first letter or digit of each word of `name`, lowercased. Words end at other characters and before a capital that follows a lowercase letter. */
export const abbreviate = (name: string): string => {
  const letters = name
    .split(/[^A-Za-z0-9]+|(?<=[a-z])(?=[A-Z])/)
    .filter((word) => word !== "")
    .map((word) => word.charAt(0).toLowerCase())
    .join("");
  return letters === "" ? "app" : letters;
};

const detectDialect = (values: Environment): DbDialect | undefined => {
  if (values.DATABASE_URL?.startsWith("postgres")) {
    return "postgres";
  }
  if (values.DATABASE_URL?.startsWith("mysql") || values.DATABASE_URL?.startsWith("mariadb")) {
    return "mysql";
  }
  if (values.DATABASE_URL?.startsWith("sqlite")) {
    return "sqlite";
  }
  if (values.POSTGRES_HOST || values.POSTGRES_DB || values.POSTGRES_USER) {
    return "postgres";
  }
  if (
    values.MYSQL_HOST ||
    values.MYSQL_DATABASE ||
    values.MYSQL_USER ||
    values.MARIADB_HOST ||
    values.MARIADB_DATABASE ||
    values.MARIADB_USER
  ) {
    return "mysql";
  }
  if (values.SQLITE_DATABASE || values.SQLITE_PATH) {
    return "sqlite";
  }
  return undefined;
};

/** Supplies the environment on demand; the first call may cost a process start, so callers call it only when needed. */
export type EnvironmentProvider = () => NodeJS.ProcessEnv;

export interface DetectedConnection {
  config: DbConfig;
  source: "env" | "default";
  /** The name of the environment variable that supplied each field of `config`. */
  variables: Partial<Record<keyof DbConfig, string>>;
}

export const detectConnection = (
  startDir = process.cwd(),
  environment: EnvironmentProvider = () => process.env,
): DetectedConnection => {
  const current = environment();
  const values: Environment = {};
  for (const key of ENV_KEYS) {
    values[key] = current[key];
  }

  const dialect = detectDialect(values);
  if (!dialect) {
    return {
      config: {
        dialect: "sqlite",
        filename: join(startDir, ".cache", "variants", "variants.db"),
      },
      source: "default",
      variables: {},
    };
  }

  const variables: DetectedConnection["variables"] = {};
  /** The first of `names` that is set, recording which one supplied `field`. */
  const take = (field: keyof DbConfig, ...names: (typeof ENV_KEYS)[number][]): string | undefined => {
    for (const name of names) {
      const value = values[name];
      if (value !== undefined) {
        variables[field] = name;
        return value;
      }
    }
    return undefined;
  };
  const config: DbConfig = {
    dialect,
    url: take("url", "DATABASE_URL"),
    host: take("host", "POSTGRES_HOST", "MYSQL_HOST", "MARIADB_HOST"),
    port: parsePort(take("port", "POSTGRES_PORT", "MYSQL_PORT", "MARIADB_PORT")),
    user: take("user", "POSTGRES_USER", "MYSQL_USER", "MARIADB_USER"),
    password: take("password", "POSTGRES_PASSWORD", "MYSQL_PASSWORD", "MARIADB_PASSWORD"),
    database: take("database", "POSTGRES_DB", "MYSQL_DATABASE", "MARIADB_DATABASE", "SQLITE_DATABASE"),
    schema: take("schema", "POSTGRES_SCHEMA", "MYSQL_SCHEMA"),
    filename: take("filename", "SQLITE_PATH"),
    ssl: parseBoolean(take("ssl", "POSTGRES_SSL")),
  };

  return { config, source: "env", variables };
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

const detectKind = (path: string): VariantWatch["kind"] | undefined => {
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
 * The command that watches an application without clearing the console, so the output of several watches stays
 * readable in one terminal. A project's own setting (`clearScreen` in the Vite config, `preserveWatchOutput` in
 * `tsconfig.json`) is left to the project; otherwise the flag is added to the command line. A `bun --watch` or
 * `--hot` script gets `--no-clear-screen` inside its own command, because flags after the file would reach the app.
 */
const detectWatch = (kind: NonNullable<VariantWatch["kind"]>, path: string): string => {
  const scripts = packageScripts(path);
  if (kind === "vite") {
    const base = scripts.dev ? "bun run dev" : "bunx --bun vite";
    return viteConfigSetsClearScreen(path) ? base : `${base} --clearScreen false`;
  }
  const script = scripts["start:dev"];
  if (script && /^bun\s+(--watch|--hot)\b/.test(script)) {
    return /--no-clear-screen\b/.test(script)
      ? script
      : script.replace(/^bun\s+(--watch|--hot)\b/, "bun $1 --no-clear-screen");
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

/** The key of an autodetected watch: its directory's base name, or its kind (`app` without one) for the configuration directory. */
const watchKeyFor = (watch: VariantWatch): string => {
  const base = watch.dir === "." ? (watch.kind ?? "app") : basename(watch.dir);
  const plain = base.replace(/[^A-Za-z0-9_-]/g, "-");
  return WATCH_KEY.test(plain) ? plain : `${watch.kind ?? "app"}-${plain}`;
};

/** The watches keyed by directory name (`web`, `web-2`, ...) and ordered by directory. */
const keyWatches = (found: readonly VariantWatch[]): Record<string, VariantWatch> => {
  const watches: Record<string, VariantWatch> = {};
  for (const watch of [...found].sort((left, right) => left.dir.localeCompare(right.dir))) {
    const base = watchKeyFor(watch);
    let key = base;
    for (let suffix = 2; key in watches; suffix += 1) {
      key = `${base}-${suffix}`;
    }
    watches[key] = watch;
  }
  return watches;
};

/** Calls `visit` for every directory below `configDir` that autodetection looks at, depth first. */
const walkDirectories = (configDir: string, visit: (directory: string) => void): void => {
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
      visit(child);
      walk(child);
    }
  };

  if (existsSync(configDir) && statSync(configDir).isDirectory()) {
    walk(configDir);
  }
};

const findKindedWatches = (configDir: string): VariantWatch[] => {
  const found: VariantWatch[] = [];
  walkDirectories(configDir, (child) => {
    const kind = detectKind(child);
    if (kind) {
      const dir = relative(configDir, child) || ".";
      const watch = detectWatch(kind, child);
      found.push(kind === "vite" ? { kind, dir, url: DEFAULT_URL, watch } : { kind, dir, watch });
    }
  });
  return found;
};

/** The applications below `configDir`, keyed by directory name (`web`, `web-2`, ...) and ordered by directory. */
export const detectWatches = (configDir: string): Record<string, VariantWatch> =>
  keyWatches(findKindedWatches(configDir));

/** Whether `name` is `watch` or has `watch` as a segment split on `:`, `-`, `_` and `.`. */
const isWatchScript = (name: string): boolean => name.split(/[:\-_.]/).includes("watch");

const LOCKFILE_RUNNERS: ReadonlyArray<readonly [string[], string]> = [
  [["bun.lock", "bun.lockb"], "bun"],
  [["pnpm-lock.yaml"], "pnpm"],
  [["yarn.lock"], "yarn"],
];

/** The package manager of the lockfile in `directory`, else in `configDir`, else `npm`. */
const runnerFor = (directory: string, configDir: string): string => {
  for (const place of [directory, configDir]) {
    for (const [files, runner] of LOCKFILE_RUNNERS) {
      if (files.some((file) => existsSync(join(place, file)))) {
        return runner;
      }
    }
  }
  return "npm";
};

/**
 * The directories at or below `configDir` that have a `package.json` with a watch-like script and are not a Vite or
 * NestJS application, as watches without a `kind` that run the first such script through the package manager of the
 * lockfile. Only `variant init` writes them: runtime autodetection does not use them.
 */
export const detectScriptWatches = (configDir: string): Record<string, VariantWatch> => {
  const found: VariantWatch[] = [];
  const consider = (directory: string): void => {
    if (!existsSync(directory) || detectKind(directory)) {
      return;
    }
    const script = Object.keys(packageScripts(directory)).find(isWatchScript);
    if (script !== undefined) {
      found.push({
        dir: relative(configDir, directory) || ".",
        watch: `${runnerFor(directory, configDir)} run ${script}`,
      });
    }
  };
  consider(configDir);
  walkDirectories(configDir, consider);
  return keyWatches(found);
};

/** The watches `variant init` writes: Vite, NestJS and script watches below `configDir`, keyed uniquely and ordered by directory. */
export const detectWatchesForInit = (configDir: string): Record<string, VariantWatch> => {
  const scripts: VariantWatch[] = Object.values(detectScriptWatches(configDir));
  return keyWatches([...findKindedWatches(configDir), ...scripts]);
};

export type OnboardingApplication = "vite" | "nestjs" | "package-script-watch";

export interface OnboardingDetection {
  /** `postgres`, `mysql`, `mariadb` or `sqlite` when one was actually detected, never the SQLite fallback. */
  database: string | undefined;
  /** The distinct kinds of application found, in the order `vite`, `nestjs`, `package-script-watch`. */
  applications: OnboardingApplication[];
  /** `<database>+<application>+...` when both a database and an application were detected. */
  label: string | undefined;
  /** Why nothing was detected, when reading the environment failed. */
  error?: unknown;
}

/** Whether the detected MySQL-dialect database is MariaDB: a `mariadb` URL, or only `MARIADB_` variables. */
const isMariaDb = (detected: DetectedConnection): boolean => {
  if (detected.config.url?.startsWith("mariadb")) {
    return true;
  }
  const names = Object.values(detected.variables);
  return names.some((name) => name.startsWith("MARIADB_")) && !names.some((name) => name.startsWith("MYSQL_"));
};

/**
 * What the onboarding notification needs: the database and the application kinds of `configDir`. The environment is
 * asked only when an application exists, and a failure of it counts as nothing detected (the error is returned).
 */
export const detectOnboarding = (
  configDir: string,
  environment: EnvironmentProvider = () => process.env,
): OnboardingDetection => {
  const kinds = new Set<OnboardingApplication>();
  for (const watch of Object.values(detectWatches(configDir))) {
    if (watch.kind) {
      kinds.add(watch.kind);
    }
  }
  if (Object.keys(detectScriptWatches(configDir)).length > 0) {
    kinds.add("package-script-watch");
  }
  const applications = (["vite", "nestjs", "package-script-watch"] as const).filter((kind) => kinds.has(kind));
  const nothing: OnboardingDetection = { database: undefined, applications: [], label: undefined };
  if (applications.length === 0) {
    return { ...nothing, applications };
  }
  let detected: DetectedConnection;
  try {
    detected = detectConnection(configDir, environment);
  } catch (error) {
    return { ...nothing, error };
  }
  if (detected.source === "default") {
    return { database: undefined, applications, label: undefined };
  }
  const database = detected.config.dialect === "mysql" && isMariaDb(detected) ? "mariadb" : detected.config.dialect;
  return { database, applications, label: [database, ...applications].join("+") };
};

export const inferConfigRoot = (path: string): string => parsePath(resolve(path)).dir;
