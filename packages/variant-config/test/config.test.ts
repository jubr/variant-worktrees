import { describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadConfig } from "../src/index.js";

const tempDirectory = (): string => mkdtempSync(join("/tmp", "variant-config-"));

describe("loadConfig", () => {
  it("prefers explicit database fields over mise values", () => {
    const directory = tempDirectory();
    try {
      writeFileSync(
        join(directory, "mise.local.toml"),
        '[env]\nPOSTGRES_HOST = "mise.host"\nPOSTGRES_PORT = 5432\nPOSTGRES_DB = "mise-db"\n',
      );
      writeFileSync(
        join(directory, "variants.yaml"),
        'db:\n  dialect: postgres\n  host: "config.host"\n  port: 6543\n  database: "config-db"\n',
      );

      const config = loadConfig({ cwd: directory });
      expect(config.db).toMatchObject({
        dialect: "postgres",
        host: "config.host",
        port: 6543,
        database: "config-db",
      });
      expect(config.source).toBe("config");
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("uses a default SQLite file when no connection environment exists", () => {
    const directory = tempDirectory();
    const keys = [
      "DATABASE_URL",
      "POSTGRES_HOST",
      "POSTGRES_PORT",
      "POSTGRES_USER",
      "POSTGRES_PASSWORD",
      "POSTGRES_DB",
      "POSTGRES_SCHEMA",
      "POSTGRES_SSL",
      "MYSQL_HOST",
      "MYSQL_PORT",
      "MYSQL_USER",
      "MYSQL_PASSWORD",
      "MYSQL_DATABASE",
      "MYSQL_SCHEMA",
      "SQLITE_DATABASE",
      "SQLITE_PATH",
    ];
    const environment = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
    try {
      for (const key of keys) {
        delete process.env[key];
      }
      const config = loadConfig({ cwd: directory });
      expect(config.db).toEqual({
        dialect: "sqlite",
        filename: join(directory, ".cache", "variants", "variants.db"),
      });
      expect(config.source).toBe("default");
    } finally {
      for (const key of keys) {
        const value = environment[key];
        if (value === undefined) {
          delete process.env[key];
        } else {
          process.env[key] = value;
        }
      }
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
