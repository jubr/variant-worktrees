import { basename, isAbsolute, relative, resolve } from "node:path";
import { Document, isScalar } from "yaml";
import {
  abbreviate,
  type DetectedConnection,
  detectConnection,
  detectVariantMain,
  detectWatchesForInit,
  type EnvironmentProvider,
} from "./autodetect.js";
import { type DbConfig, type DbDialect, DEFAULT_PREFIX, type VariantWatch } from "./schema.js";

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
    dialect: DbDialect;
    /** `env` when the database was found in the environment, `default` when only SQLite was written. */
    databaseSource: DetectedConnection["source"];
    abbr: string;
    prefix: string;
    /** The keys of the written watches. */
    watches: string[];
  };
}

const DIALECTS: readonly DbDialect[] = ["postgres", "sqlite", "mysql"];
const KINDS: readonly NonNullable<VariantWatch["kind"]>[] = ["vite", "nestjs"];

/** Whether a connection URL carries a password (`scheme://user:password@host/...`). */
const urlHasPassword = (url: string): boolean => /^[A-Za-z][A-Za-z0-9+.-]*:\/\/[^/?#@]*:[^/?#@]+@/.test(url);

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
  const dialect = config.dialect ?? "sqlite";
  db.dialect = dialect;
  note(["db", "dialect"], others(DIALECTS, dialect));
  if (source === "env") {
    const reference = (field: "host" | "port" | "user" | "password" | "url"): void => {
      const name = variables[field];
      db[field] = `\${${name}}`;
      note(["db", field], fromWhere(name as string));
    };
    const postgresSetting = (field: "host" | "port" | "user"): boolean =>
      dialect === "postgres" && variables[field]?.startsWith("POSTGRES_") === true;
    const fields: (keyof DbConfig)[] = [
      "url",
      "host",
      "port",
      "user",
      "password",
      "database",
      "schema",
      "filename",
      "ssl",
    ];
    for (const field of fields) {
      const value = config[field];
      if (value === undefined) {
        continue;
      }
      if (field === "password" && variables.password !== undefined) {
        reference("password");
      } else if (field === "url" && variables.url !== undefined && urlHasPassword(value as string)) {
        reference("url");
      } else if ((field === "host" || field === "port" || field === "user") && postgresSetting(field)) {
        reference(field);
      } else if (field !== "dialect") {
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

  const document = new Document({ db, variant });
  document.commentBefore =
    " Written by `variant init` from what autodetection found. Other accepted values follow `#` on the same line.";
  for (const [path, text] of notes) {
    const node = document.getIn(path, true);
    if (isScalar(node)) {
      node.comment = ` ${text}`;
    }
  }

  return {
    text: document.toString({ lineWidth: 0 }),
    detected: { dialect, databaseSource: source, abbr, prefix, watches: Object.keys(writtenWatches) },
  };
};
