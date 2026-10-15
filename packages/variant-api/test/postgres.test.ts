import { describe, expect, it } from "bun:test";
import { PostgresAdapter } from "../src/db/postgres.js";

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
