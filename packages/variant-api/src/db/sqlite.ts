import { Database } from "bun:sqlite";
import { existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { drizzle } from "drizzle-orm/bun-sqlite";
import type { DbConfig } from "variant-config";
import type { DatabaseAdapter } from "../types.js";

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
    const database = new Database(filename);
    void drizzle(database);
    database.close();
    return filename;
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
