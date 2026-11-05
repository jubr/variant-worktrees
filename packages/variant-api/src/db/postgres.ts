import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { type DbConfig, multiLikePattern } from "variant-config";
import type { DatabaseAdapter } from "../types.js";
import { contactTarget, QueryGuard } from "./failure.js";

const quoteIdentifier = (value: string): string => `"${value.replaceAll('"', '""')}"`;

/** `CREATE SCHEMA IF NOT EXISTS`, so a schema that already holds data is left as it is. */
export const createSchemaSql = (name: string): string => `CREATE SCHEMA IF NOT EXISTS ${quoteIdentifier(name)}`;

/** Schemas whose names start with `prefix`. `_` and `%` in the prefix match literally. */
export const matchingSchemasSql = (prefix: string): string => {
  const pattern = multiLikePattern(prefix).replaceAll("'", "''");
  return `SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE '${pattern}' ESCAPE '\\'`;
};

const dropSchemaSql = (name: string): string => `DROP SCHEMA IF EXISTS ${quoteIdentifier(name)} CASCADE`;

const schemaFor = (slug: string): string => `v_${slug.replaceAll("-", "_")}`;

const connectionUrl = (config: DbConfig): string => {
  if (config.url) {
    return config.url;
  }
  const user = encodeURIComponent(config.user ?? "postgres");
  const password = encodeURIComponent(config.password ?? "");
  const host = config.host ?? "127.0.0.1";
  const port = config.port ?? 5432;
  const database = encodeURIComponent(config.database ?? "postgres");
  return `postgres://${user}:${password}@${host}:${port}/${database}`;
};

export class PostgresAdapter implements DatabaseAdapter {
  readonly dialect = "postgres";
  private readonly client;
  private readonly db;
  private readonly guard: QueryGuard;

  constructor(config: DbConfig) {
    this.guard = new QueryGuard(contactTarget(config));
    this.client = postgres(connectionUrl(config), {
      ssl: config.ssl ? "require" : undefined,
      connect_timeout: 5,
      // AIDEV-NOTE: postgres.js prints notices (e.g. "schema already exists") with console.log, which would corrupt the JSON on stdout.
      onnotice: () => {},
    });
    this.db = drizzle(this.client);
  }

  /** Runs one statement. A contact failure warns once per adapter; the statement, if any, is debug. */
  private execute<T>(query: ReturnType<typeof sql.raw>): Promise<T> {
    return this.guard.run(() => this.db.execute<T>(query));
  }

  target(slug: string): string {
    return schemaFor(slug);
  }

  async create(slug: string): Promise<string> {
    const schema = this.target(slug);
    await this.createSchema(schema);
    return schema;
  }

  async createSchema(name: string): Promise<void> {
    await this.execute(sql.raw(createSchemaSql(name)));
  }

  async matchingSchemas(prefix: string): Promise<string[]> {
    const rows = await this.execute<{ schema_name: string }>(sql.raw(matchingSchemasSql(prefix)));
    return rows.map((row) => row.schema_name);
  }

  async dropSchema(name: string): Promise<void> {
    await this.execute(sql.raw(dropSchemaSql(name)));
  }

  async destroy(slug: string): Promise<boolean> {
    await this.dropSchema(this.target(slug));
    return true;
  }

  async list(): Promise<string[]> {
    const rows = await this.execute<{ schema_name: string }>(
      sql`SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE 'v\\_%'`,
    );
    return rows.map((row) => row.schema_name);
  }

  async close(): Promise<void> {
    await this.client.end({ timeout: 1 });
  }
}
