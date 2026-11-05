import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { createPool } from "mysql2/promise";
import type { DbConfig } from "variant-config";
import type { DatabaseAdapter } from "../types.js";
import { contactTarget, QueryGuard } from "./failure.js";

const quoteIdentifier = (value: string): string => `\`${value.replaceAll("`", "``")}\``;

const databaseFor = (slug: string): string => `v_${slug.replaceAll("-", "_")}`;

/** mysql2 wants a number. A resolved `db.port` is already an integer; a digit string is accepted at the boundary. */
const tcpPort = (port: DbConfig["port"], fallback: number): number => {
  if (typeof port === "number") {
    return port;
  }
  if (port === undefined) {
    return fallback;
  }
  const numeric = Number(port);
  if (!Number.isInteger(numeric) || numeric <= 0) {
    throw new Error(`db.port must be a positive integer, got ${port}`);
  }
  return numeric;
};

export class MysqlAdapter implements DatabaseAdapter {
  readonly dialect = "mysql";
  private readonly pool;
  private readonly db;
  private readonly guard: QueryGuard;

  constructor(config: DbConfig) {
    this.guard = new QueryGuard(contactTarget(config));
    this.pool = config.url
      ? createPool(config.url)
      : createPool({
          host: config.host ?? "127.0.0.1",
          port: tcpPort(config.port, 3306),
          user: config.user ?? "root",
          password: config.password,
          database: config.database,
          connectTimeout: 5000,
          ssl: config.ssl ? {} : undefined,
        });
    this.db = drizzle(this.pool);
  }

  private execute(statement: string): Promise<unknown> {
    return this.guard.run(() => this.db.execute(sql.raw(statement)));
  }

  target(slug: string): string {
    return databaseFor(slug);
  }

  async create(slug: string): Promise<string> {
    const database = this.target(slug);
    await this.execute(`CREATE DATABASE IF NOT EXISTS ${quoteIdentifier(database)}`);
    return database;
  }

  async createSchema(): Promise<void> {
    throw new Error("db.multi needs PostgreSQL, not mysql");
  }

  async matchingSchemas(): Promise<string[]> {
    return [];
  }

  async dropSchema(): Promise<void> {
    throw new Error("db.multi needs PostgreSQL, not mysql");
  }

  async destroy(slug: string): Promise<boolean> {
    const database = this.target(slug);
    await this.execute(`DROP DATABASE IF EXISTS ${quoteIdentifier(database)}`);
    return true;
  }

  async list(): Promise<string[]> {
    const [rows] = await this.guard.run(() =>
      this.pool.query("SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME LIKE 'v\\_%'"),
    );
    return (rows as Array<{ SCHEMA_NAME: string }>).map((row) => row.SCHEMA_NAME);
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
