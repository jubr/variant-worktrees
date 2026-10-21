import { describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { detectConnection } from "../src/autodetect.js";

const tempDirectory = (): string => mkdtempSync(join("/tmp", "variant-autodetect-"));

describe("detectConnection", () => {
  it("reads PostgreSQL values from the nearest mise.local.toml", () => {
    const directory = tempDirectory();
    try {
      writeFileSync(
        join(directory, "mise.local.toml"),
        [
          "[env]",
          'POSTGRES_HOST = "127.0.0.1"',
          "POSTGRES_PORT = 5432",
          'POSTGRES_USER = "variant"',
          'POSTGRES_PASSWORD = "secret"',
          'POSTGRES_DB = "variants"',
          "POSTGRES_SSL = false",
          "",
        ].join("\n"),
      );

      const detected = detectConnection(directory);
      expect(detected.source).toBe("mise");
      expect(detected.config).toMatchObject({
        dialect: "postgres",
        host: "127.0.0.1",
        port: 5432,
        user: "variant",
        password: "secret",
        database: "variants",
        ssl: false,
      });
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
