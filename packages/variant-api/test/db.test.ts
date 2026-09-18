import { describe, expect, it } from "bun:test";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { createDatabaseAdapter } from "../src/db/index.js";

const tempDirectory = (): string => mkdtempSync(join("/tmp", "variant-db-"));

describe("database adapters", () => {
  it("creates and removes SQLite variant files", async () => {
    const directory = tempDirectory();
    const adapter = createDatabaseAdapter({ dialect: "sqlite" }, directory);
    try {
      const target = await adapter.create("test-feature");
      expect(target).toBe(join(directory, "test-feature.db"));
      expect(existsSync(target)).toBe(true);
      expect(await adapter.list()).toEqual(["test-feature"]);
      expect(await adapter.destroy("test-feature")).toBe(true);
      expect(existsSync(target)).toBe(false);
    } finally {
      await adapter.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("rejects unknown database dialects", () => {
    expect(() => createDatabaseAdapter({ dialect: "oracle" as never }, "/tmp")).toThrow(
      "Unsupported database dialect: oracle",
    );
  });
});
