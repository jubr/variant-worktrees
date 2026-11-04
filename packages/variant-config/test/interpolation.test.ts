import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadConfig } from "../src/index.js";

/** Specification: openspec/specs/variant-config/core/spec.md (Interpolation in every setting) */

let directory: string;

beforeEach(() => {
  directory = mkdtempSync(join("/tmp", "variant-interpolation-"));
});

afterEach(() => {
  rmSync(directory, { recursive: true, force: true });
});

const load = (yaml: string, environment: NodeJS.ProcessEnv = {}): ReturnType<typeof loadConfig> => {
  writeFileSync(join(directory, "variants.yaml"), yaml);
  return loadConfig({ cwd: directory, environment: () => environment });
};

describe("interpolation in db", () => {
  it("resolves a password reference from the environment", () => {
    const config = load("db:\n  dialect: postgres\n  host: h\n  password: ${POSTGRES_PASSWORD}\n", {
      POSTGRES_PASSWORD: "s3",
    });

    expect(config.db.password).toBe("s3");
  });

  it("resolves a URL reference from the environment", () => {
    const config = load("db:\n  dialect: postgres\n  url: ${DATABASE_URL}\n", {
      DATABASE_URL: "postgres://app@localhost/app",
    });

    expect(config.db.url).toBe("postgres://app@localhost/app");
  });

  it("uses a default when the variable is set nowhere", () => {
    const config = load("db:\n  dialect: postgres\n  host: ${DB_HOST:-127.0.0.1}\n");

    expect(config.db.host).toBe("127.0.0.1");
  });

  it("fails naming the setting and the variable when the variable is set nowhere", () => {
    const config = load("db:\n  dialect: postgres\n  host: h\n  password: ${MISSING}\n");

    expect(() => config.db).toThrow(/db\.password/);
    expect(() => config.db).toThrow(/MISSING/);
  });

  it("fails naming the setting for a variant placeholder, since db has no variant", () => {
    const config = load("db:\n  dialect: postgres\n  host: h\n  schema: ${slug}\n");

    expect(() => config.db).toThrow(/db\.schema/);
    expect(() => config.db).toThrow(/slug/);
  });

  it("loads a configuration with an unset reference as long as db is not read", () => {
    const config = load("db:\n  dialect: postgres\n  host: h\n  password: ${MISSING}\nvariant:\n  prefix: wt-\n");

    expect(config.variant.prefix).toBe("wt-");
  });
});

describe("interpolation in other settings", () => {
  it("expands an environment reference in the dir of a watch where it is used", () => {
    const config = load("variant:\n  watches:\n    fe:\n      dir: ${FE_DIR}\n", { FE_DIR: "apps/fe" });

    expect(config.variant.watches.fe?.dir).toBe("apps/fe");
  });

  it("leaves a regular expression as written", () => {
    const config = load(
      "variant:\n  steps:\n    build:\n      cmd: make\n      filterLinesRegex: '^price: ${PRICE}$'\n      runBefore: seed\n",
    );

    expect(config.variant.steps.build?.filterLinesRegex).toBe("^price: ${PRICE}$");
  });

  it("exposes the environment provider to use sites, called at most once", () => {
    let calls = 0;
    writeFileSync(join(directory, "variants.yaml"), "variant:\n  prefix: wt-\n");
    const config = loadConfig({
      cwd: directory,
      environment: () => {
        calls += 1;
        return { A: "1" };
      },
    });

    expect(config.environment().A).toBe("1");
    expect(config.environment().A).toBe("1");
    expect(calls).toBe(1);
  });
});
