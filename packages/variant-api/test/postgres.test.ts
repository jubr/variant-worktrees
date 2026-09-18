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
});
