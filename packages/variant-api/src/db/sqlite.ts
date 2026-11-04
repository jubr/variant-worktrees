import { existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import type { DbConfig } from "variant-config";
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

const filenameFor = (config: DbConfig, stateDir: string, slug: string): string => {
  if (config.filename?.includes("{slug}")) {
    return config.filename.replace("{slug}", slug);
  }
  const base = config.filename ? dirname(config.filename) : stateDir;
  return join(base, `${slug}.db`);
};

export class SqliteAdapter implements DatabaseAdapter {
  readonly dialect = "sqlite";

  constructor(
    private readonly config: DbConfig,
    private readonly stateDir: string,
  ) {}

  target(slug: string): string {
    return filenameFor(this.config, this.stateDir, slug);
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

  async list(): Promise<string[]> {
    if (!existsSync(this.stateDir)) {
      return [];
    }
    return readdirSync(this.stateDir)
      .filter((filename) => filename.endsWith(".db"))
      .map((filename) => basename(filename, ".db"))
      .sort();
  }

  async close(): Promise<void> {}
}
