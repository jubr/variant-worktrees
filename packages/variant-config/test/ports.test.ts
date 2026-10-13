import { describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadConfig, openUrlFor, resolveInstancePort } from "../src/index.js";
import { pickFreePort } from "../src/ports.js";

const PROJECT = [
  "db:",
  "  dialect: sqlite",
  "variant:",
  "  instances:",
  "    fe:",
  "      kind: vite",
  "      dir: fe",
  "      open: http://{{slug}}.vw.localhost:{{port}}",
  "    be:",
  "      kind: nestjs",
  "      dir: be",
  "    my-api:",
  "      kind: nestjs",
  "      dir: api",
  "",
].join("\n");

const withProject = async (
  local: string | undefined,
  run: (directory: string, load: (env?: NodeJS.ProcessEnv) => ReturnType<typeof loadConfig>) => Promise<void> | void,
): Promise<void> => {
  const directory = mkdtempSync(join("/tmp", "variant-ports-"));
  try {
    writeFileSync(join(directory, "variants.yaml"), PROJECT);
    if (local !== undefined) {
      writeFileSync(join(directory, "variants.local.yaml"), local);
    }
    await run(directory, (env = {}) => loadConfig({ cwd: directory, env }));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
};

const assigned = "runtime:\n  instances:\n    fe:\n      port: 62060\n    be:\n      port: 62061\n";

describe("resolveInstancePort", () => {
  it("reads the port of the instance's key from the runtime state", () =>
    withProject(assigned, async (_directory, load) => {
      const config = load();

      expect(await resolveInstancePort(config, "fe")).toBe(62060);
      expect(await resolveInstancePort(config, "be")).toBe(62061);
    }));

  it("picks a random free port when the runtime state has none", () =>
    withProject(undefined, async (_directory, load) => {
      const port = await resolveInstancePort(load(), "fe");

      expect(Number.isInteger(port)).toBe(true);
      expect(port).toBeGreaterThanOrEqual(1024);
      expect(port).toBeLessThanOrEqual(65535);
    }));

  it("prefers VARIANT_<KEY>_PORT over the runtime state", () =>
    withProject(assigned, async (_directory, load) => {
      expect(await resolveInstancePort(load({ VARIANT_FE_PORT: "62070" }), "fe")).toBe(62070);
    }));

  it("reads a hyphenated key through its underscored segment", () =>
    withProject(undefined, async (_directory, load) => {
      expect(await resolveInstancePort(load({ VARIANT_MY_API_PORT: "62010" }), "my-api")).toBe(62010);
    }));

  it("accepts an explicitly assigned reserved port", () =>
    withProject(undefined, async (_directory, load) => {
      expect(await resolveInstancePort(load({ VARIANT_BE_PORT: "3000" }), "be")).toBe(3000);
    }));

  it("treats an empty variable as unset", () =>
    withProject(assigned, async (_directory, load) => {
      expect(await resolveInstancePort(load({ VARIANT_BE_PORT: "" }), "be")).toBe(62061);
    }));
});

describe("pickFreePort", () => {
  it("skips reserved ports", async () => {
    const candidates = [3000, 4200, 5432, 62000][Symbol.iterator]();

    expect(await pickFreePort([3000, 4200, 5432], async () => candidates.next().value as number)).toBe(62000);
  });

  it("accepts any port when nothing is reserved", async () => {
    expect(await pickFreePort([], async () => 3000)).toBe(3000);
  });
});

describe("runtime environment overrides", () => {
  it("override the file for port, url and pid", () =>
    withProject(
      "runtime:\n  instances:\n    be:\n      port: 62060\n      pid: 11\n      url: http://old\n",
      (_directory, load) => {
        const config = load({
          VARIANT_BE_PORT: "62099",
          VARIANT_BE_URL: "http://new.localhost:62099",
          VARIANT_BE_PID: "99",
        });

        expect(config.runtime?.instances?.be).toEqual({ port: 62099, pid: 99, url: "http://new.localhost:62099" });
      },
    ));

  it("create runtime state when no file exists", () =>
    withProject(undefined, (_directory, load) => {
      const config = load({ VARIANT_FE_URL: "http://demo.vw.localhost:62060" });

      expect(config.runtime?.instances?.fe).toEqual({ url: "http://demo.vw.localhost:62060" });
    }));

  it("ignore variables of instances that are not configured", () =>
    withProject(undefined, (_directory, load) => {
      expect(load({ VARIANT_OTHER_PORT: "62099" }).runtime).toBeUndefined();
    }));

  it("fail naming the variable when the value is invalid", () =>
    withProject(undefined, (_directory, load) => {
      expect(() => load({ VARIANT_BE_PORT: "abc" })).toThrow("VARIANT_BE_PORT");
      expect(() => load({ VARIANT_BE_PID: "0" })).toThrow("VARIANT_BE_PID");
      expect(() => load({ VARIANT_BE_URL: "not a url" })).toThrow("VARIANT_BE_URL");
    }));

  it("are not applied to a state read by directory", () =>
    withProject(assigned, async (directory) => {
      const { readRuntime } = await import("../src/index.js");

      expect(readRuntime(directory, { VARIANT_BE_PORT: "62099" })?.instances?.be?.port).toBe(62061);
    }));
});

describe("openUrlFor", () => {
  it("replaces {{slug}} and {{port}} in the instance template", () =>
    withProject(assigned, async (_directory, load) => {
      expect(await openUrlFor(load(), "add-auth", "fe")).toBe("http://add-auth.vw.localhost:62060");
    }));

  it("returns nothing for an instance without a template", () =>
    withProject(undefined, async (_directory, load) => {
      expect(await openUrlFor(load(), "add-auth", "be")).toBeUndefined();
    }));
});
