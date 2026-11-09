import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadConfig } from "./index.js";

/**
 * Specification: openspec/specs/tools/mise/spec.md (Environment read through Mise)
 *
 * `loadConfig` takes the environment as a lazy provider, so nothing is read until a value is needed.
 */

let directory: string;

beforeEach(() => {
  directory = mkdtempSync(join("/tmp", "variant-environment-"));
});

afterEach(() => {
  rmSync(directory, { recursive: true, force: true });
});

const counting = (values: NodeJS.ProcessEnv): { provider: () => NodeJS.ProcessEnv; calls: () => number } => {
  let calls = 0;
  return {
    provider: () => {
      calls += 1;
      return values;
    },
    calls: () => calls,
  };
};

describe("loadConfig environment provider", () => {
  it("does not call the provider when nothing reads the database", () => {
    writeFileSync(join(directory, "variants.yaml"), "variant:\n  seed: ./seed.sh\n");
    const environment = counting({ POSTGRES_HOST: "db.local" });

    const config = loadConfig({ cwd: directory, environment: environment.provider });

    expect(config.variant.prefix).toBe("_v-");
    expect(environment.calls()).toBe(0);
  });

  it("detects the database from the provider on first use", () => {
    const environment = counting({ POSTGRES_HOST: "db.local", POSTGRES_PORT: "5433", POSTGRES_DB: "app" });

    const config = loadConfig({ cwd: directory, environment: environment.provider });

    expect(config.db).toMatchObject({ dialect: "postgres", host: "db.local", port: 5433, database: "app" });
    expect(environment.calls()).toBe(1);
  });

  it("calls the provider at most once however often values are read", () => {
    const environment = counting({ POSTGRES_HOST: "db.local" });

    const config = loadConfig({ cwd: directory, environment: environment.provider });
    void config.db;
    void config.db;
    void config.source;

    expect(environment.calls()).toBe(1);
  });

  it("lets explicit database fields win over the provider values", () => {
    writeFileSync(join(directory, "variants.yaml"), "db:\n  dialect: postgres\n  host: config.host\n");
    const environment = counting({ POSTGRES_HOST: "env.host", POSTGRES_DB: "env-db" });

    const config = loadConfig({ cwd: directory, environment: environment.provider });

    expect(config.db).toMatchObject({ host: "config.host", database: "env-db" });
    expect(config.source).toBe("config");
  });

  it("does not call the provider for an explicit SQLite database, which the environment cannot change", () => {
    writeFileSync(join(directory, "variants.yaml"), "db:\n  dialect: sqlite\n");
    const environment = counting({ POSTGRES_HOST: "db.local" });

    const config = loadConfig({ cwd: directory, environment: environment.provider });

    expect(config.db).toMatchObject({ dialect: "sqlite" });
    expect(config.source).toBe("config");
    expect(environment.calls()).toBe(0);
  });

  it("uses the process environment when no provider is given", () => {
    const previous = process.env.POSTGRES_HOST;
    process.env.POSTGRES_HOST = "process.host";
    try {
      expect(loadConfig({ cwd: directory }).db.host).toBe("process.host");
    } finally {
      if (previous === undefined) {
        delete process.env.POSTGRES_HOST;
      } else {
        process.env.POSTGRES_HOST = previous;
      }
    }
  });
});
