import { describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadConfig, seedCommandFor } from "./index.js";

const tempDirectory = (): string => mkdtempSync(join("/tmp", "variant-config-"));

describe("loadConfig", () => {
  it("prefers explicit database fields over environment values", () => {
    const directory = tempDirectory();
    try {
      writeFileSync(
        join(directory, "variants.yaml"),
        'db:\n  dialect: postgres\n  host: "config.host"\n  port: 6543\n  database: "config-db"\n',
      );

      const config = loadConfig({
        cwd: directory,
        environment: () => ({ POSTGRES_HOST: "env.host", POSTGRES_PORT: "5432", POSTGRES_DB: "env-db" }),
      });
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

  it("keeps source readable and leaves it out of the printed keys", () => {
    const directory = tempDirectory();
    try {
      const config = loadConfig({ cwd: directory, environment: () => ({}) });
      expect(config.source).toBe("default");
      expect(Object.keys(config)).not.toContain("source");
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("uses a default SQLite file when no connection environment exists", () => {
    const directory = tempDirectory();
    try {
      const config = loadConfig({ cwd: directory, environment: () => ({}) });
      expect(config.db).toEqual({
        dialect: "sqlite",
        filename: join(directory, ".cache", "variants", "variants.db"),
      });
      expect(config.source).toBe("default");
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("resolves the seed command from variant.seed, which a per-variant seed overrides", () => {
    const directory = tempDirectory();
    try {
      writeFileSync(
        join(directory, "variants.yaml"),
        "variant:\n  seed: bun run db:seed\nvariants:\n  main:\n    seed: echo skip\n",
      );

      const config = loadConfig({ cwd: directory });

      expect(seedCommandFor(config, "other")).toBe("bun run db:seed");
      expect(seedCommandFor(config, "main")).toBe("echo skip");
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("resolves the default prefix _v-", () => {
    const directory = tempDirectory();
    try {
      writeFileSync(join(directory, "variants.yaml"), "variant:\n  seed: ./seed.sh\n");

      expect(loadConfig({ cwd: directory }).variant?.prefix).toBe("_v-");
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("resolves a configured prefix", () => {
    const directory = tempDirectory();
    try {
      writeFileSync(join(directory, "variants.yaml"), "variant:\n  prefix: _work-\n");

      expect(loadConfig({ cwd: directory }).variant?.prefix).toBe("_work-");
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
