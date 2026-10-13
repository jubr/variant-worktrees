import { describe, expect, it } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import { clearRuntime, loadConfig, readRuntime, writeRuntime } from "../src/index.js";
import { VariantsLocalSchema } from "../src/schema.js";

const withProject = (local: string | undefined, run: (directory: string) => void): void => {
  const directory = mkdtempSync(join("/tmp", "variant-local-"));
  try {
    writeFileSync(join(directory, "variants.yaml"), "db:\n  dialect: sqlite\n");
    if (local !== undefined) {
      writeFileSync(join(directory, "variants.local.yaml"), local);
    }
    run(directory);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
};

describe("VariantsLocalSchema", () => {
  const parse = (runtime: unknown) => VariantsLocalSchema.safeParse({ runtime });

  it("accepts the full runtime section, with a port template in the database settings", () => {
    const result = parse({
      slug: "demo",
      mode: "watch",
      dir: "/work/_v-demo",
      db: { dialect: "postgres", schema: "v_demo", port: "{{POSTGRES_PORT}}" },
      instances: { fe: { port: 62060, pid: 123, url: "http://demo.vw.localhost:62060/" }, be: { port: 62061 } },
    });

    expect(result.success).toBe(true);
  });

  it("reuses the database rules: a negative port and an unknown key fail", () => {
    expect(parse({ db: { port: -1 } }).success).toBe(false);
    expect(parse({ db: { nope: 1 } }).success).toBe(false);
  });

  it("tolerates other top-level keys, which writeRuntime keeps, while the runtime section stays strict", () => {
    expect(VariantsLocalSchema.safeParse({ other: "kept", runtime: { slug: "demo" } }).success).toBe(true);
    expect(VariantsLocalSchema.safeParse({ other: "kept", runtime: { nope: 1 } }).success).toBe(false);
  });

  it("rejects a non-numeric port string, a zero pid, an unknown mode and an unknown key", () => {
    expect(parse({ db: { port: "soon" } }).success).toBe(false);
    expect(parse({ instances: { fe: { pid: 0 } } }).success).toBe(false);
    expect(parse({ mode: "dev" }).success).toBe(false);
    expect(parse({ unknown: true }).success).toBe(false);
  });
});

describe("readRuntime and loadConfig", () => {
  it("carries the runtime section in the resolved configuration", () =>
    withProject("runtime:\n  slug: demo\n  instances:\n    fe:\n      port: 62060\n", (directory) => {
      expect(loadConfig({ cwd: directory }).runtime).toEqual({ slug: "demo", instances: { fe: { port: 62060 } } });
    }));

  it("has no runtime state without a local file", () =>
    withProject(undefined, (directory) => {
      expect(loadConfig({ cwd: directory }).runtime).toBeUndefined();
    }));

  it("replaces {{NAME}} from the environment and turns a numeric db.port into a number", () =>
    withProject("runtime:\n  db:\n    port: '{{POSTGRES_PORT}}'\n    schema: v_{{SLUG_ENV}}\n", (directory) => {
      expect(readRuntime(directory, { POSTGRES_PORT: "5433", SLUG_ENV: "demo" })).toEqual({
        db: { port: 5433, schema: "v_demo" },
      });
    }));

  it("leaves db.port out when the variable is unset", () =>
    withProject("runtime:\n  db:\n    port: '{{POSTGRES_PORT}}'\n    schema: v_demo\n", (directory) => {
      expect(readRuntime(directory, {})).toEqual({ db: { schema: "v_demo" } });
    }));

  it("fails validation on an invalid local file", () =>
    withProject("runtime:\n  instances:\n    fe:\n      pid: 0\n", (directory) => {
      expect(() => loadConfig({ cwd: directory })).toThrow();
    }));
});

describe("writeRuntime", () => {
  it("writes the runtime section and keeps other top-level keys", () =>
    withProject("other: kept\nruntime:\n  slug: old\n", (directory) => {
      writeRuntime(directory, { slug: "demo", instances: { fe: { port: 62060, pid: 123 } } });

      const written = parseYaml(readFileSync(join(directory, "variants.local.yaml"), "utf8"));
      expect(written).toEqual({
        other: "kept",
        runtime: { slug: "demo", instances: { fe: { port: 62060, pid: 123 } } },
      });
    }));

  it("creates the file when none exists", () =>
    withProject(undefined, (directory) => {
      writeRuntime(directory, { slug: "demo" });

      expect(readRuntime(directory)).toEqual({ slug: "demo" });
    }));

  it("refuses an invalid runtime section", () =>
    withProject(undefined, (directory) => {
      expect(() => writeRuntime(directory, { instances: { fe: { pid: 0 } } })).toThrow();
    }));
});

describe("clearRuntime", () => {
  it("removes the runtime section and keeps other top-level keys", () =>
    withProject("other: kept\nruntime:\n  slug: demo\n", (directory) => {
      clearRuntime(directory);

      expect(parseYaml(readFileSync(join(directory, "variants.local.yaml"), "utf8"))).toEqual({ other: "kept" });
    }));

  it("removes a file that held only the runtime section", () =>
    withProject("runtime:\n  slug: demo\n", (directory) => {
      clearRuntime(directory);

      expect(existsSync(join(directory, "variants.local.yaml"))).toBe(false);
    }));

  it("does nothing without a file", () =>
    withProject(undefined, (directory) => {
      clearRuntime(directory);

      expect(existsSync(join(directory, "variants.local.yaml"))).toBe(false);
    }));
});
