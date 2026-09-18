import { describe, expect, it } from "bun:test";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { SqliteAdapter } from "../src/db/sqlite.js";

describe("SqliteAdapter", () => {
  it("creates a database file for each slug", async () => {
    const directory = mkdtempSync(join("/tmp", "variant-sqlite-"));
    const adapter = new SqliteAdapter({ dialect: "sqlite" }, directory);
    try {
      const target = await adapter.create("test-feature");
      expect(existsSync(target)).toBe(true);
      expect(target).toBe(join(directory, "test-feature.db"));
    } finally {
      await adapter.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
