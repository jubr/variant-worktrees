import { describe, expect, it } from "bun:test";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { createDatabaseAdapter } from "./index.js";
import { loadDatabase, SqliteAdapter } from "./sqlite.js";

describe("sqlite driver selection", () => {
  it("fails with an error naming SQLite and Node 22.13 when the runtime has no driver", async () => {
    const missing = async (): Promise<never> => {
      throw new Error("No such built-in module: node:sqlite");
    };
    await expect(loadDatabase(false, missing)).rejects.toThrow(/SQLite.*Node 22\.13/);
  });

  it("asks for bun:sqlite under Bun and node:sqlite under Node", async () => {
    const asked: string[] = [];
    const load = async (specifier: string): Promise<Record<string, unknown>> => {
      asked.push(specifier);
      return { Database: class {}, DatabaseSync: class {} };
    };
    await loadDatabase(true, load);
    await loadDatabase(false, load);
    expect(asked).toEqual(["bun:sqlite", "node:sqlite"]);
  });
});

describe("SqliteAdapter", () => {
  it("creates a database file for each slug", async () => {
    const directory = mkdtempSync(join("/tmp", "variant-sqlite-"));
    const adapter = new SqliteAdapter({ dialect: "sqlite" }, directory);
    try {
      const target = await adapter.create("test-feature");
      expect(existsSync(target)).toBe(true);
      expect(target).toBe(join(directory, "test-feature.db"));
      expect(await adapter.list()).toEqual(["test-feature"]);
      expect(await adapter.destroy("test-feature")).toBe(true);
      expect(existsSync(target)).toBe(false);
    } finally {
      await adapter.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });
});

describe("createDatabaseAdapter", () => {
  it("rejects unknown database dialects", () => {
    expect(() => createDatabaseAdapter({ dialect: "oracle" as never }, "/tmp")).toThrow(
      "Unsupported database dialect: oracle",
    );
  });
});
