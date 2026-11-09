import { describe, expect, it } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import { clearRuntime, loadConfig, readRuntime, writeRuntime } from "./index.js";
import { VariantsLocalSchema } from "./schema.js";

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
      db: { dialect: "postgres", schema: "v_demo", port: "${POSTGRES_PORT}" },
      watches: { fe: { port: 62060, pid: 123, url: "http://demo.vw.localhost:62060/" }, be: { port: 62061 } },
    });

    expect(result.success).toBe(true);
  });

  it("accepts the log path of a detached watch and rejects an empty one", () => {
    expect(parse({ log: "/work/_v-demo/variants.watch.log" }).success).toBe(true);
    expect(parse({ log: "" }).success).toBe(false);
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
    expect(parse({ watches: { fe: { pid: 0 } } }).success).toBe(false);
    expect(parse({ mode: "dev" }).success).toBe(false);
    expect(parse({ unknown: true }).success).toBe(false);
  });

  it("accepts createdAt and a watch startedAt in local stamp form", () => {
    const result = parse({
      createdAt: "2026-11-04_12:22:05",
      watches: { fe: { startedAt: "2026-11-04_12:30:00", pid: 123, url: "http://demo.vw.localhost:62060" } },
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.runtime?.createdAt).toBe("2026-11-04_12:22:05");
      expect(result.data.runtime?.watches?.fe?.startedAt).toBe("2026-11-04_12:30:00");
    }
  });

  it("rejects a createdAt or startedAt that is not YYYY-MM-DD_HH:MM:SS", () => {
    expect(parse({ createdAt: "yesterday" }).success).toBe(false);
    expect(parse({ createdAt: "2026-11-04T12:22:05" }).success).toBe(false);
    expect(parse({ createdAt: "2026-02-31_00:00:00" }).success).toBe(false);
    expect(parse({ watches: { fe: { startedAt: "noon" } } }).success).toBe(false);
  });
});

describe("readRuntime and loadConfig", () => {
  it("carries the runtime section in the resolved configuration", () =>
    withProject("runtime:\n  slug: demo\n  watches:\n    fe:\n      port: 62060\n", (directory) => {
      expect(loadConfig({ cwd: directory }).runtime).toEqual({ slug: "demo", watches: { fe: { port: 62060 } } });
    }));

  it("has no runtime state without a local file", () =>
    withProject(undefined, (directory) => {
      expect(loadConfig({ cwd: directory }).runtime).toBeUndefined();
    }));

  it("replaces ${NAME} from the environment and turns a numeric db.port into a number", () =>
    withProject("runtime:\n  db:\n    port: '${POSTGRES_PORT}'\n    schema: v_${SLUG_ENV}\n", (directory) => {
      expect(readRuntime(directory, { POSTGRES_PORT: "5433", SLUG_ENV: "demo" })).toEqual({
        db: { port: 5433, schema: "v_demo" },
      });
    }));

  it("leaves db.port out when the variable is unset", () =>
    withProject("runtime:\n  db:\n    port: '${POSTGRES_PORT}'\n    schema: v_demo\n", (directory) => {
      expect(readRuntime(directory, {})).toEqual({ db: { schema: "v_demo" } });
    }));

  it("carries createdAt and a watch startedAt", () =>
    withProject(
      "runtime:\n  createdAt: 2026-11-04_12:22:05\n  watches:\n    fe:\n      startedAt: 2026-11-04_12:30:00\n      pid: 123\n      url: http://demo.vw.localhost:62060\n",
      (directory) => {
        expect(loadConfig({ cwd: directory }).runtime).toEqual({
          createdAt: "2026-11-04_12:22:05",
          watches: { fe: { startedAt: "2026-11-04_12:30:00", pid: 123, url: "http://demo.vw.localhost:62060" } },
        });
      },
    ));

  it("fails validation on an invalid local file", () =>
    withProject("runtime:\n  watches:\n    fe:\n      pid: 0\n", (directory) => {
      expect(() => loadConfig({ cwd: directory })).toThrow();
    }));

  it("fails validation when createdAt is not a local stamp", () =>
    withProject("runtime:\n  createdAt: yesterday\n", (directory) => {
      expect(() => loadConfig({ cwd: directory })).toThrow();
    }));
});

const statePath = (directory: string): string => join(directory, ".cache", "variant", "state.yaml");

describe("writeRuntime", () => {
  it("writes state.yaml and does not create or rewrite variants.local.yaml", () =>
    withProject("other: kept\nruntime:\n  slug: old\n", (directory) => {
      const before = readFileSync(join(directory, "variants.local.yaml"), "utf8");

      writeRuntime(directory, { slug: "demo", watches: { fe: { port: 62060, pid: 123 } } });

      expect(parseYaml(readFileSync(statePath(directory), "utf8"))).toEqual({
        slug: "demo",
        watches: { fe: { port: 62060, pid: 123 } },
      });
      expect(readFileSync(join(directory, "variants.local.yaml"), "utf8")).toBe(before);
      expect(readFileSync(statePath(directory), "utf8").startsWith("# yaml-language-server:")).toBe(false);
    }));

  it("creates the cache files when none exist", () =>
    withProject(undefined, (directory) => {
      writeRuntime(directory, {
        slug: "demo",
        db: { dialect: "postgres", schema: "v_demo", password: "secret" },
      });

      expect(readRuntime(directory)).toEqual({
        slug: "demo",
        db: { dialect: "postgres", schema: "v_demo", password: "secret" },
      });
      expect(existsSync(join(directory, "variants.local.yaml"))).toBe(false);
      expect(parseYaml(readFileSync(statePath(directory), "utf8"))).toEqual({
        slug: "demo",
        dialect: "postgres",
        target: "v_demo",
      });
      const dump = parseYaml(readFileSync(join(directory, ".cache", "variant", "runtime.yaml"), "utf8")) as {
        db: { password?: string };
      };
      expect(dump.db.password).toBe("secret");
    }));

  it("leaves the modification time alone when the text is unchanged", () =>
    withProject(undefined, (directory) => {
      writeRuntime(directory, { slug: "demo" });
      const first = statSync(statePath(directory)).mtimeMs;

      writeRuntime(directory, { slug: "demo" });

      expect(statSync(statePath(directory)).mtimeMs).toBe(first);
    }));

  it("refuses an invalid runtime section", () =>
    withProject(undefined, (directory) => {
      expect(() => writeRuntime(directory, { watches: { fe: { pid: 0 } } })).toThrow();
    }));
});

describe("clearRuntime", () => {
  it("drops mode and watches from state.yaml and leaves a legacy file unchanged", () =>
    withProject("other: kept\nruntime:\n  slug: demo\n  mode: watch\n", (directory) => {
      const before = readFileSync(join(directory, "variants.local.yaml"), "utf8");

      clearRuntime(directory);

      expect(readFileSync(join(directory, "variants.local.yaml"), "utf8")).toBe(before);
      expect(readRuntime(directory)).toEqual({ slug: "demo" });
    }));

  it("keeps identity fields that were written to state.yaml", () =>
    withProject(undefined, (directory) => {
      writeRuntime(directory, { slug: "demo", mode: "watch", watches: { fe: { port: 1 } } });

      clearRuntime(directory);

      expect(readRuntime(directory)).toEqual({ slug: "demo" });
      expect(existsSync(join(directory, "variants.local.yaml"))).toBe(false);
    }));

  it("does nothing without a file", () =>
    withProject(undefined, (directory) => {
      clearRuntime(directory);

      expect(existsSync(join(directory, "variants.local.yaml"))).toBe(false);
      expect(existsSync(statePath(directory))).toBe(false);
    }));
});
