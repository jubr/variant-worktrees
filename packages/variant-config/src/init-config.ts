import { basename, isAbsolute, relative, resolve } from "node:path";
import { Document, isScalar } from "yaml";
import {
  abbreviate,
  type DefaultBranchVia,
  type DetectedConnection,
  detectConnection,
  detectDefaultBranch,
  detectVariantMain,
  detectWatchesForInit,
  type EnvironmentProvider,
} from "./autodetect.js";
import { schemaHeaderFor } from "./header.js";
import { type DbConfig, type DbType, DEFAULT_PREFIX, type VariantWatch } from "./schema.js";

/**
 * Specification: openspec/specs/variant-api/init/spec.md
 *
 * The `variants.yaml` of `variant init`: every value that autodetection resolves for a directory, secrets as `${NAME}`
 * references, and the other accepted values of a constrained setting in a comment on the same line.
 */

export interface RenderInitConfigOptions {
  /** The worktree directory prefix; `_v-` by default. */
  prefix?: string;
  /** Supplies the environment the database is detected from; the process environment by default. */
  environment?: EnvironmentProvider;
  /** Where each variable is defined: its name to the absolute path of the file (see `readVariableSources` of variant-api). */
  sources?: Readonly<Record<string, string>>;
}

export interface RenderedInitConfig {
  /** The file content. */
  text: string;
  /** What was detected and written, without any secret. */
  detected: {
    type: DbType;
    /** `env` when the database was found in the environment, `default` when only SQLite was written. */
    databaseSource: DetectedConnection["source"];
    abbr: string;
    prefix: string;
    /** The default git branch written as `variant.baseBranch`; `null` when none was detected and none written. */
    baseBranch: string | null;
    /** The keys of the written watches. */
    watches: string[];
  };
}

const TYPES: readonly DbType[] = ["postgres", "sqlite", "mysql"];
const KINDS: readonly NonNullable<VariantWatch["kind"]>[] = ["vite", "nestjs"];

/** Whether a connection URL carries a password (`scheme://user:password@host/...`). */
const urlHasPassword = (url: string): boolean => /^[A-Za-z][A-Za-z0-9+.-]*:\/\/[^/?#@]*:[^/?#@]+@/.test(url);

/** The same-line comment of `variant.baseBranch`, by the signal that found the branch. */
const BRANCH_SIGNAL_NOTES: Record<DefaultBranchVia, string> = {
  "origin/HEAD": "from origin/HEAD",
  "init.defaultBranch": "from init.defaultBranch",
  "local branch": "local branch",
  "checked out": "checked out",
};

const others = <T>(all: readonly T[], current: T | undefined): string =>
  all.filter((item) => item !== current).join(" | ");

type Path = readonly (string | number)[];

export const renderInitConfig = (directory: string, options: RenderInitConfigOptions = {}): RenderedInitConfig => {
  const dir = resolve(directory);
  const prefix = options.prefix ?? DEFAULT_PREFIX;
  const sources = options.sources ?? {};
  const detectedConnection = detectConnection(dir, options.environment);
  const abbr = abbreviate(basename(detectVariantMain(dir)));
  const watches = detectWatchesForInit(dir);
  const defaultBranch = detectDefaultBranch(dir);

  const notes: [Path, string][] = [];
  const note = (path: Path, text: string): void => {
    notes.push([path, text]);
  };

  const fromWhere = (name: string): string => {
    const source = sources[name];
    return source !== undefined && isAbsolute(source) ? `from ${relative(dir, source)}` : "from the environment";
  };

  const db: Record<string, unknown> = {};
  const { config, variables, source } = detectedConnection;
  const type = config.type ?? "sqlite";
  db.type = type;
  note(["db", "type"], others(TYPES, type));
  if (source === "env") {
    const reference = (field: "host" | "port" | "user" | "password" | "url" | "database", suffix = ""): void => {
      const name = variables[field];
      db[field] = `\${${name}}${suffix}`;
      note(["db", field], fromWhere(name as string));
    };
    // the variables of the server type itself: POSTGRES_* for PostgreSQL, MYSQL_* and MARIADB_* for MySQL
    const serverSetting = (field: "host" | "port" | "user" | "database"): boolean => {
      const name = variables[field];
      return type === "postgres"
        ? name?.startsWith("POSTGRES_") === true
        : type === "mysql" && (name?.startsWith("MYSQL_") === true || name?.startsWith("MARIADB_") === true);
    };
    const fields: (keyof DbConfig)[] = ["url", "host", "port", "user", "password", "database", "schema", "ssl"];
    for (const field of fields) {
      const value = config[field];
      if (value === undefined || (field === "database" && variables.database === undefined && type === "sqlite")) {
        continue;
      }
      if (field === "password" && variables.password !== undefined) {
        reference("password");
      } else if (field === "url" && variables.url !== undefined && urlHasPassword(value as string)) {
        reference("url");
      } else if (field === "database" && type === "mysql" && serverSetting(field)) {
        // each variant gets a database of its own: the name from the environment is the prefix of it
        reference(field, "__${schema}");
      } else if (
        (field === "host" || field === "port" || field === "user" || field === "database") &&
        serverSetting(field)
      ) {
        reference(field);
      } else if (field !== "type") {
        db[field] = value;
      }
    }
    if (config.ssl !== undefined) {
      note(["db", "ssl"], config.ssl ? "false" : "true");
    }
  }

  const variant: Record<string, unknown> = { abbr, prefix };
  note(["variant", "abbr"], "lowercase letters and digits, single hyphens between");
  note(["variant", "prefix"], "starts every name derived from a slug; keep the connector");
  if (defaultBranch !== undefined) {
    variant.baseBranch = defaultBranch.branch;
    note(["variant", "baseBranch"], BRANCH_SIGNAL_NOTES[defaultBranch.via]);
  }

  const writtenWatches: Record<string, Record<string, unknown>> = {};
  for (const [key, watch] of Object.entries(watches)) {
    const written: Record<string, unknown> = {};
    if (watch.kind) {
      written.kind = watch.kind;
      note(["variant", "watches", key, "kind"], others(KINDS, watch.kind));
    }
    if (watch.dir !== key) {
      written.dir = watch.dir;
    }
    for (const field of ["up", "watch", "url"] as const) {
      if (watch[field] !== undefined) {
        written[field] = watch[field];
      }
    }
    writtenWatches[key] = written;
  }
  if (Object.keys(writtenWatches).length > 0) {
    variant.watches = writtenWatches;
  }

  // AIDEV-NOTE: nothing detected means no `db` key at all: autodetection already resolves SQLite, so writing it would only pin a default.
  const document = new Document(source === "env" ? { db, variant } : { variant });
  document.commentBefore =
    " Written by `variant init` from what autodetection found. Other accepted values follow `#` on the same line.";
  for (const [path, text] of notes) {
    const node = document.getIn(path, true);
    if (isScalar(node)) {
      node.comment = ` ${text}`;
    }
  }

  return {
    // AIDEV-NOTE: the header is the text `addSchemaHeader` would add, so the migration of the next command finds nothing to do and saves no `variants.yaml~`.
    text: `${schemaHeaderFor("variants.yaml")}\n\n${document.toString({ lineWidth: 0 })}`,
    detected: {
      type,
      databaseSource: source,
      abbr,
      prefix,
      baseBranch: defaultBranch?.branch ?? null,
      watches: Object.keys(writtenWatches),
    },
  };
};
