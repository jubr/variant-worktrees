import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import type { DbConfig } from "variant-config";
import type { DatabaseAdapter } from "../types.js";

const quoteIdentifier = (value: string): string => `"${value.replaceAll('"', '""')}"`;

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

  constructor(config: DbConfig) {
    this.client = postgres(connectionUrl(config), {
      ssl: config.ssl ? "require" : undefined,
    });
    this.db = drizzle(this.client);
  }

  target(slug: string): string {
    return schemaFor(slug);
  }

  async create(slug: string): Promise<string> {
    const schema = this.target(slug);
    await this.db.execute(sql.raw(`CREATE SCHEMA IF NOT EXISTS ${quoteIdentifier(schema)}`));
    return schema;
  }

  async destroy(slug: string): Promise<boolean> {
    const schema = this.target(slug);
    await this.db.execute(sql.raw(`DROP SCHEMA IF EXISTS ${quoteIdentifier(schema)} CASCADE`));
    return true;
  }

  async list(): Promise<string[]> {
    const rows = await this.db.execute<{ schema_name: string }>(
      sql`SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE 'v\\_%'`,
    );
    return rows.map((row) => row.schema_name);
  }

  async close(): Promise<void> {
    await this.client.end({ timeout: 1 });
  }
}
