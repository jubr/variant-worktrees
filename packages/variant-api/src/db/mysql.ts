import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { createPool } from "mysql2/promise";
import type { DbConfig } from "variant-config";
import type { DatabaseAdapter } from "../types.js";
import { contactTarget, QueryGuard } from "./failure.js";
import { hasSchemaPlaceholder, mysqlDatabase, schemaOfDatabase, variantDatabasePattern } from "./mysql-names.js";

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
  readonly type = "mysql";
  private readonly pool;
  private readonly db;
  private readonly guard: QueryGuard;
  /** `db.database`: a template with `${schema}` names the database of each variant. */
  private readonly template: string | undefined;

  constructor(config: DbConfig) {
    this.template = config.database;
    // fail early for a template the databases cannot be listed by
    variantDatabasePattern(this.template);
    this.guard = new QueryGuard(contactTarget(config));
    this.pool = config.url
      ? createPool(config.url)
      : createPool({
          host: config.host ?? "127.0.0.1",
          port: tcpPort(config.port, 3306),
          user: config.user ?? "root",
          password: config.password,
          // the database of a variant does not exist before `create`, so the connection starts in none
          database: hasSchemaPlaceholder(config.database) ? undefined : config.database,
          connectTimeout: 5000,
          ssl: config.ssl ? {} : undefined,
        });
    this.db = drizzle(this.pool);
  }

  private execute(statement: string): Promise<unknown> {
    return this.guard.run(() => this.db.execute(sql.raw(statement)));
  }

  silenceContact(): void {
    this.guard.silence();
  }

  target(slug: string): string {
    return databaseFor(slug);
  }

  /** The database of `slug`: `db.database` with its schema name filled in, else the schema name. */
  private databaseOf(slug: string): string {
    return mysqlDatabase(this.template, this.target(slug));
  }

  async create(slug: string): Promise<string> {
    const database = this.databaseOf(slug);
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
    const database = this.databaseOf(slug);
    await this.execute(`DROP DATABASE IF EXISTS ${quoteIdentifier(database)}`);
    return true;
  }

  async list(): Promise<string[]> {
    const [rows] = await this.guard.run(() =>
      this.pool.query("SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME LIKE ?", [
        variantDatabasePattern(this.template),
      ]),
    );
    return (rows as Array<{ SCHEMA_NAME: string }>)
      .map((row) => schemaOfDatabase(this.template, row.SCHEMA_NAME))
      .filter((schema): schema is string => schema !== undefined);
  }

  async assertReachable(): Promise<void> {
    await this.guard.run(() => this.pool.query("SELECT 1"));
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
