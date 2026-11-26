import { existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { basename, dirname, extname, isAbsolute, join, resolve } from "node:path";
import { type DbConfig, DEFAULT_SQLITE_DATABASE } from "variant-config";
import type { DatabaseAdapter } from "../types.js";

/** What both drivers' database classes share: opening a file creates it, `close` releases it. */
type Database = new (filename: string) => { close(): void };

type Load = (specifier: string) => Promise<Record<string, unknown>>;

// AIDEV-NOTE: the specifier lives in a variable so `bun build` leaves the import alone: neither driver may be reachable at load time.
// AIDEV-NOTE: node:sqlite prints an ExperimentalWarning on stderr when first loaded (Node 22); the CLI promises unchanged output, so only that warning is dropped while the import runs.
const importModule: Load = async (specifier) => {
  const emitWarning = process.emitWarning;
  process.emitWarning = ((warning: string | Error, ...rest: unknown[]) => {
    const text = typeof warning === "string" ? warning : warning.message;
    if (!text.startsWith("SQLite is an experimental feature")) {
      (emitWarning as (...args: unknown[]) => void).call(process, warning, ...rest);
    }
  }) as typeof process.emitWarning;
  try {
    return await import(specifier);
  } finally {
    process.emitWarning = emitWarning;
  }
};

/**
 * Loads the sqlite driver of the running runtime: `bun:sqlite` under Bun, `node:sqlite` (Node 22.13+) otherwise.
 *
 * Specification: openspec/specs/variant-api/node-runtime/spec.md (SQLite variants under both runtimes)
 */
export const loadDatabase = async (bun: boolean, load: Load = importModule): Promise<Database> => {
  const [specifier, name] = bun ? ["bun:sqlite", "Database"] : ["node:sqlite", "DatabaseSync"];
  try {
    return (await load(specifier))[name] as Database;
  } catch (error) {
    throw new Error(`The SQLite dialect needs bun:sqlite (Bun) or node:sqlite (Node 22.13 or newer): ${String(error)}`);
  }
};

/** Where the SQLite files of the slugs live: the directory of each variant, and the slugs that have one. */
export interface SqliteLayout {
  /** The directory a relative `db.database` is resolved against for `slug`: its worktree, or the main checkout. */
  directoryOf(slug: string): string;
  /** The slugs that have a worktree directory; `main` is not among them. */
  slugs(): string[];
}

const SLUG = "{slug}";

/** `name` of a template as a pattern that captures the slug, or `undefined` when the name has no `{slug}`. */
const slugPattern = (name: string): RegExp | undefined => {
  if (!name.includes(SLUG)) {
    return undefined;
  }
  const escaped = name.split(SLUG).map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return new RegExp(`^${escaped.join("(.+)")}$`);
};

/**
 * Specification: openspec/specs/variant-api/core/spec.md (One SQLite target for every slug)
 *
 * The database file of each slug is `db.database` (default `.cache/variants/{slug}.sqlite`) with `{slug}` replaced; a
 * relative path is resolved against the directory of that variant, an absolute path stays.
 */
export class SqliteAdapter implements DatabaseAdapter {
  readonly dialect = "sqlite";

  constructor(
    private readonly config: DbConfig,
    private readonly layout: SqliteLayout,
  ) {}

  private get template(): string {
    return this.config.database ?? DEFAULT_SQLITE_DATABASE;
  }

  /** The file of `slug` before the check against the file of `main`. */
  private fileOf(slug: string): string {
    const template = this.template;
    const own = resolve(this.layout.directoryOf(slug), template.replaceAll(SLUG, slug));
    if (template.includes(SLUG) || !isAbsolute(template) || slug === "main") {
      return own;
    }
    return join(dirname(own), `${slug}${extname(own)}`);
  }

  target(slug: string): string {
    const file = this.fileOf(slug);
    if (slug !== "main" && file === this.fileOf("main")) {
      throw new Error(
        `The SQLite file of ${slug} would be the file of main (${file}): add {slug} to db.database (${this.template}) or name a directory`,
      );
    }
    return file;
  }

  async create(slug: string): Promise<string> {
    const filename = this.target(slug);
    mkdirSync(dirname(filename), { recursive: true });
    const Driver = await loadDatabase(Boolean(process.versions.bun));
    new Driver(filename).close();
    return filename;
  }

  async createSchema(): Promise<void> {
    throw new Error("db.multi needs PostgreSQL, not sqlite");
  }

  async matchingSchemas(): Promise<string[]> {
    return [];
  }

  async dropSchema(): Promise<void> {
    throw new Error("db.multi needs PostgreSQL, not sqlite");
  }

  async destroy(slug: string): Promise<boolean> {
    const filename = this.target(slug);
    if (!existsSync(filename)) {
      return false;
    }
    rmSync(filename);
    return true;
  }

  /** The directories that can hold a file named by the template, for every known variant directory. */
  private directories(): string[] {
    const template = this.template;
    const directoryPart = dirname(template);
    if (directoryPart.includes(SLUG)) {
      return [];
    }
    if (isAbsolute(template)) {
      return [directoryPart];
    }
    const slugs = ["main", ...this.layout.slugs()];
    return [...new Set(slugs.map((slug) => resolve(this.layout.directoryOf(slug), directoryPart)))];
  }

  async list(): Promise<string[]> {
    const candidates = new Set(this.layout.slugs());
    const template = this.template;
    const pattern = slugPattern(basename(template));
    const extension = extname(template);
    for (const directory of this.directories()) {
      if (!existsSync(directory)) {
        continue;
      }
      // a template without {slug} names the file of main; the files of the other slugs sit beside it with its extension
      const sharesName = pattern === undefined && isAbsolute(template) && extension !== "";
      for (const name of pattern || sharesName ? readdirSync(directory) : []) {
        const slug = pattern
          ? pattern.exec(name)?.[1]
          : name.endsWith(extension)
            ? basename(name, extension)
            : undefined;
        if (slug !== undefined) {
          candidates.add(slug);
        }
      }
    }
    const found: string[] = [];
    for (const slug of candidates) {
      if (slug === "main") {
        continue;
      }
      try {
        if (existsSync(this.target(slug))) {
          found.push(slug);
        }
      } catch {
        // a slug whose file would be the file of main is not a variant of its own
      }
    }
    return found.sort();
  }

  async close(): Promise<void> {}
}
