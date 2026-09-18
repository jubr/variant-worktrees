import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { createPool } from "mysql2/promise";
import type { DbConfig } from "variant-config";
import type { DatabaseAdapter } from "../types.js";

const quoteIdentifier = (value: string): string => `\`${value.replaceAll("`", "``")}\``;

const databaseFor = (slug: string): string => `v_${slug.replaceAll("-", "_")}`;

export class MysqlAdapter implements DatabaseAdapter {
  readonly dialect = "mysql";
  private readonly pool;
  private readonly db;

  constructor(config: DbConfig) {
    this.pool = config.url
      ? createPool(config.url)
      : createPool({
          host: config.host ?? "127.0.0.1",
          port: config.port ?? 3306,
          user: config.user ?? "root",
          password: config.password,
          database: config.database,
          ssl: config.ssl ? {} : undefined,
        });
    this.db = drizzle(this.pool);
  }

  target(slug: string): string {
    return databaseFor(slug);
  }

  async create(slug: string): Promise<string> {
    const database = this.target(slug);
    await this.db.execute(sql.raw(`CREATE DATABASE IF NOT EXISTS ${quoteIdentifier(database)}`));
    return database;
  }

  async destroy(slug: string): Promise<boolean> {
    const database = this.target(slug);
    await this.db.execute(sql.raw(`DROP DATABASE IF EXISTS ${quoteIdentifier(database)}`));
    return true;
  }

  async list(): Promise<string[]> {
    const [rows] = await this.pool.query(
      "SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME LIKE 'v\\_%'",
    );
    return (rows as Array<{ SCHEMA_NAME: string }>).map((row) => row.SCHEMA_NAME);
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
