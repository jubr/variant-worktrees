import { describe, expect, it } from "bun:test";
import { createSchemaSql, matchingSchemasSql, PostgresAdapter } from "../src/db/postgres.js";

describe("PostgresAdapter", () => {
  it("maps slugs to isolated schema names", async () => {
    const adapter = new PostgresAdapter({
      dialect: "postgres",
      host: "127.0.0.1",
      database: "variants",
    });
    try {
      expect(adapter.target("test-feature")).toBe("v_test_feature");
    } finally {
      await adapter.close();
    }
  });

  it("creates a tenant schema without replacing one that already exists", () => {
    expect(createSchemaSql("v_demo-east")).toBe('CREATE SCHEMA IF NOT EXISTS "v_demo-east"');
  });

  it("matches a prefix with a literal underscore", () => {
    expect(matchingSchemasSql("v_demo-")).toBe(
      "SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE 'v\\_demo-%' ESCAPE '\\'",
    );
  });

  it("keeps server notices off standard output", async () => {
    const adapter = new PostgresAdapter({ dialect: "postgres", host: "127.0.0.1", database: "variants" });
    const logged: unknown[] = [];
    const original = console.log;
    console.log = (...args: unknown[]) => void logged.push(args);
    try {
      const { onnotice } = (adapter as unknown as { client: { options: { onnotice: (notice: object) => void } } })
        .client.options;
      onnotice({ message: 'schema "v_demo" already exists, skipping' });
    } finally {
      console.log = original;
      await adapter.close();
    }
    expect(logged).toEqual([]);
  });
});
