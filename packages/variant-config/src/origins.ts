import { basename, relative, sep } from "node:path";

/**
 * Specification: openspec/specs/variant-config/core/spec.md
 * The cwd-relative path of the loaded configuration file, as an origin comment.
 */
export const configFileOrigin = (cwd: string, configPath: string): string => {
  const relativePath = relative(cwd, configPath).split(sep).join("/");
  const shown = relativePath === "" || relativePath === "." ? basename(configPath) : relativePath;
  return `# from ${shown.startsWith(".") ? shown : `./${shown}`}`;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const assignTree = (origins: Record<string, string>, path: string, value: unknown, origin: string): void => {
  origins[path] = origin;
  if (!isRecord(value)) {
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    assignTree(origins, `${path}.${key}`, child, origin);
  }
};

/** Built-in defaults and discovered watches for keys the file omits. */
export const fillDefaultOrigins = (origins: Record<string, string>, watches: unknown): void => {
  if (origins["variant.prefix"] === undefined) {
    origins["variant.prefix"] = "# default";
  }
  if (origins["variant.main"] === undefined) {
    origins["variant.main"] = "# autodetect main";
  }
  if (origins["variant.root"] === undefined) {
    origins["variant.root"] = "# autodetect root";
  }
  if (origins["variant.watches"] === undefined) {
    assignTree(origins, "variant.watches", watches, "# autodetect watch");
  }
};

/** Database fields the file omits: an environment variable, the sqlite default, or a detected empty slot. */
export const fillDbOrigins = (
  origins: Record<string, string>,
  detected: {
    source: "env" | "default";
    variables: Partial<Record<string, string>>;
    config: object;
  },
  env: NodeJS.ProcessEnv,
): void => {
  const config = detected.config as Record<string, unknown>;
  for (const field of Object.keys(config)) {
    const path = `db.${field}`;
    if (origins[path] !== undefined) {
      continue;
    }
    if (field === "dialect") {
      const variable = detected.source === "env" ? dialectVariable(env) : undefined;
      origins[path] = variable ? `# from env ${variable}` : "# default";
      continue;
    }
    const variable = detected.variables[field];
    if (variable) {
      origins[path] = `# from env ${variable}`;
      continue;
    }
    origins[path] = detected.source === "default" ? "# default" : "# autodetect connection";
  }
  if (origins.db === undefined) {
    origins.db = detected.source === "default" ? "# default" : "# autodetect connection";
  }
  if (origins["db.dialect"] === undefined) {
    const variable = dialectVariable(env);
    origins["db.dialect"] = variable ? `# from env ${variable}` : "# default";
  }
};

const dialectVariable = (env: NodeJS.ProcessEnv): string | undefined => {
  const url = env.DATABASE_URL;
  if (
    url?.startsWith("postgres") ||
    url?.startsWith("mysql") ||
    url?.startsWith("mariadb") ||
    url?.startsWith("sqlite")
  ) {
    return "DATABASE_URL";
  }
  for (const name of [
    "POSTGRES_HOST",
    "POSTGRES_DB",
    "POSTGRES_USER",
    "MYSQL_HOST",
    "MYSQL_DATABASE",
    "MYSQL_USER",
    "MARIADB_HOST",
    "MARIADB_DATABASE",
    "MARIADB_USER",
    "SQLITE_DATABASE",
    "SQLITE_PATH",
  ]) {
    if (env[name]) {
      return name;
    }
  }
  return undefined;
};

const ENV_TEMPLATE = /\$\{([A-Za-z_][A-Za-z0-9_]*)(?::-([^{}]*))?\}/g;

/** The variable that supplies a templated string, when one is set or has no fallback. */
export const supplyingVariable = (value: unknown, env: NodeJS.ProcessEnv): string | undefined => {
  if (typeof value !== "string" || !value.includes("${")) {
    return undefined;
  }
  let unset: string | undefined;
  for (const match of value.matchAll(ENV_TEMPLATE)) {
    const name = match[1] ?? "";
    const set = env[name];
    if (set !== undefined && set !== "") {
      return name;
    }
    if (match[2] === undefined) {
      unset = name;
    }
  }
  return unset;
};

/** Replace a file origin with `# from env NAME` when a template's variable is set. */
export const applyTemplateOrigins = (origins: Record<string, string>, raw: unknown, env: NodeJS.ProcessEnv): void => {
  const walk = (value: unknown, path: string): void => {
    const name = supplyingVariable(value, env);
    if (path !== "" && name !== undefined) {
      origins[path] = `# from env ${name}`;
    }
    if (!isRecord(value)) {
      return;
    }
    for (const [key, child] of Object.entries(value)) {
      walk(child, path === "" ? key : `${path}.${key}`);
    }
  };
  walk(raw, "");
};

const gapOrigin = (path: string): string => {
  if (path === "variant.abbr") {
    return "# autodetect abbr";
  }
  if (path === "variant.main") {
    return "# autodetect main";
  }
  if (path === "variant.root") {
    return "# autodetect root";
  }
  if (path === "configPath" || path === "configDir" || path === "warnings" || path.startsWith("warnings.")) {
    return "# autodetect config";
  }
  if (path === "migrations" || path.startsWith("migrations.")) {
    return "# autodetect config";
  }
  if (path === "runtime" || path.startsWith("runtime.")) {
    return "# autodetect runtime";
  }
  if (path === "source" || path === "db" || path.startsWith("db.")) {
    return "# autodetect connection";
  }
  if (path === "variant.watches" || path.startsWith("variant.watches.")) {
    return "# autodetect watch";
  }
  return "# default";
};

/** Fill any resolved path the earlier passes did not name. Existing origins stay. */
export const fillGapOrigins = (origins: Record<string, string>, value: unknown, path = ""): void => {
  if (path !== "" && origins[path] === undefined) {
    origins[path] = gapOrigin(path);
  }
  if (Array.isArray(value)) {
    for (const [index, child] of value.entries()) {
      fillGapOrigins(origins, child, `${path}.${index}`);
    }
    return;
  }
  if (!isRecord(value)) {
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    fillGapOrigins(origins, child, path === "" ? key : `${path}.${key}`);
  }
};

/** An origin for every path present in the raw file. Templates are classified later. */
export const originsFromRaw = (raw: unknown, origin: string): Record<string, string> => {
  const origins: Record<string, string> = {};
  const walk = (value: unknown, path: string): void => {
    if (path !== "") {
      origins[path] = origin;
    }
    if (!isRecord(value)) {
      return;
    }
    for (const [key, child] of Object.entries(value)) {
      walk(child, path === "" ? key : `${path}.${key}`);
    }
  };
  walk(raw, "");
  return origins;
};

/** The origin comment of each path. Absent from enumeration of the configuration. */
export const configOrigins = (config: object): Readonly<Record<string, string>> =>
  (config as { origins?: Readonly<Record<string, string>> }).origins ?? {};
