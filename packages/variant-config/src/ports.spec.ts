import { describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DEFAULT_URL, loadConfig, openUrlFor, resolveWatchPort } from "./index.js";
import { pickFreePort } from "./ports.js";

const PROJECT = [
  "db:",
  "  dialect: sqlite",
  "variant:",
  "  watches:",
  "    fe:",
  "      kind: vite",
  "      dir: fe",
  "      url: http://${slug}.vw.localhost:${port}",
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

const assigned = "runtime:\n  watches:\n    fe:\n      port: 62060\n    be:\n      port: 62061\n";

describe("resolveWatchPort", () => {
  it("reads the port of the watch's key from the runtime state", () =>
    withProject(assigned, async (_directory, load) => {
      const config = load();

      expect(await resolveWatchPort(config, "fe")).toBe(62060);
      expect(await resolveWatchPort(config, "be")).toBe(62061);
    }));

  it("picks a random free port when the runtime state has none", () =>
    withProject(undefined, async (_directory, load) => {
      const port = await resolveWatchPort(load(), "fe");

      expect(Number.isInteger(port)).toBe(true);
      expect(port).toBeGreaterThanOrEqual(42000);
      expect(port).toBeLessThanOrEqual(42999);
    }));

  it("prefers VARIANT_<KEY>_PORT over the runtime state", () =>
    withProject(assigned, async (_directory, load) => {
      expect(await resolveWatchPort(load({ VARIANT_FE_PORT: "62070" }), "fe")).toBe(62070);
    }));

  it("reads a hyphenated key through its underscored segment", () =>
    withProject(undefined, async (_directory, load) => {
      expect(await resolveWatchPort(load({ VARIANT_MY_API_PORT: "62010" }), "my-api")).toBe(62010);
    }));

  it("picks from variant.ports.range when one is configured", () =>
    withProject(undefined, async (directory, load) => {
      writeFileSync(join(directory, "variants.yaml"), `${PROJECT}  ports:\n    range: "50000-50003"\n`);
      const port = await resolveWatchPort(load(), "fe");

      expect(port).toBeGreaterThanOrEqual(50000);
      expect(port).toBeLessThanOrEqual(50003);
    }));

  it("keeps an explicitly assigned port that lies outside the range", () =>
    withProject(undefined, async (_directory, load) => {
      expect(await resolveWatchPort(load({ VARIANT_BE_PORT: "3000" }), "be")).toBe(3000);
    }));

  it("treats an empty variable as unset", () =>
    withProject(assigned, async (_directory, load) => {
      expect(await resolveWatchPort(load({ VARIANT_BE_PORT: "" }), "be")).toBe(62061);
    }));
});

describe("pickFreePort", () => {
  const range = { low: 50000, high: 50009 };
  const everythingFree = async () => true;

  it("returns a port inside the range", async () => {
    for (let attempt = 0; attempt < 20; attempt++) {
      const port = await pickFreePort(range, { isFree: everythingFree });

      expect(port).toBeGreaterThanOrEqual(range.low);
      expect(port).toBeLessThanOrEqual(range.high);
    }
  });

  it("tries the ports in order from the start offset", async () => {
    expect(await pickFreePort(range, { isFree: everythingFree, start: 3 })).toBe(50003);
  });

  it("skips ports that are in use", async () => {
    const inUse = new Set([50003, 50004]);

    expect(await pickFreePort(range, { isFree: async (port) => !inUse.has(port), start: 3 })).toBe(50005);
  });

  it("wraps once from the top of the range to its bottom", async () => {
    const free = new Set([50001]);

    expect(await pickFreePort(range, { isFree: async (port) => free.has(port), start: 8 })).toBe(50001);
  });

  it("skips excluded ports", async () => {
    expect(await pickFreePort(range, { isFree: everythingFree, start: 3, exclude: [50003, 50004] })).toBe(50005);
  });

  it("throws an error that names the range when no port is free", async () => {
    await expect(pickFreePort(range, { isFree: async () => false })).rejects.toThrow("50000-50009");
  });

  it("throws when every free port is excluded", async () => {
    const exclude = [50000, 50001, 50002, 50003, 50004, 50005, 50006, 50007, 50008, 50009];

    await expect(pickFreePort(range, { isFree: everythingFree, exclude })).rejects.toThrow("50000-50009");
  });

  it("asks the operating system by default and returns a port it reports free", async () => {
    const port = await pickFreePort({ low: 51000, high: 51999 });

    expect(port).toBeGreaterThanOrEqual(51000);
    expect(port).toBeLessThanOrEqual(51999);
  });

  it("does not return a port that a listener holds", async () => {
    const { createServer } = await import("node:net");
    const holder = createServer();
    await new Promise<void>((resolve) => holder.listen(0, "127.0.0.1", resolve));
    const held = (holder.address() as { port: number }).port;
    try {
      const port = await pickFreePort({ low: held, high: held + 1 });

      expect(port).toBe(held + 1);
    } finally {
      holder.close();
    }
  });
});

describe("runtime environment overrides", () => {
  it("override the file for port, url and pid", () =>
    withProject(
      "runtime:\n  watches:\n    be:\n      port: 62060\n      pid: 11\n      url: http://old\n",
      (_directory, load) => {
        const config = load({
          VARIANT_BE_PORT: "62099",
          VARIANT_BE_URL: "http://new.localhost:62099",
          VARIANT_BE_PID: "99",
        });

        expect(config.runtime?.watches?.be).toEqual({ port: 62099, pid: 99, url: "http://new.localhost:62099" });
      },
    ));

  it("create runtime state when no file exists", () =>
    withProject(undefined, (_directory, load) => {
      const config = load({ VARIANT_FE_URL: "http://demo.vw.localhost:62060" });

      expect(config.runtime?.watches?.fe).toEqual({ url: "http://demo.vw.localhost:62060" });
    }));

  it("ignore variables of watches that are not configured", () =>
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
      const { readRuntime } = await import("./index.js");

      expect(readRuntime(directory, { VARIANT_BE_PORT: "62099" })?.watches?.be?.port).toBe(62061);
    }));
});

describe("openUrlFor", () => {
  it("replaces ${slug} and ${port} in the watch template", () =>
    withProject(assigned, async (_directory, load) => {
      expect(await openUrlFor(load(), "add-auth", "fe")).toBe("http://add-auth.vw.localhost:62060");
    }));

  it("returns nothing for a watch without a template", () =>
    withProject(undefined, async (_directory, load) => {
      expect(await openUrlFor(load(), "add-auth", "be")).toBeUndefined();
    }));
});

describe("openUrlFor with an abbreviation", () => {
  const withAbbr = async (yaml: string, run: (config: ReturnType<typeof loadConfig>) => Promise<void>) => {
    const directory = mkdtempSync(join("/tmp", "variant-open-"));
    try {
      writeFileSync(join(directory, "variants.yaml"), yaml);
      writeFileSync(join(directory, "variants.local.yaml"), "runtime:\n  watches:\n    fe:\n      port: 62060\n");
      await run(loadConfig({ cwd: directory, env: {} }));
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  };

  it("renders the default Vite template with the project abbreviation", () =>
    withAbbr(
      `variant:\n  abbr: vw\n  watches:\n    fe:\n      kind: vite\n      dir: fe\n      url: ${DEFAULT_URL}\n`,
      async (config) => {
        expect(await openUrlFor(config, "add-auth", "fe")).toBe("http://add-auth.vw.localhost:62060");
      },
    ));

  it("renders ${abbr} in an explicit template", () =>
    withAbbr(
      "variant:\n  abbr: otc\n  watches:\n    fe:\n      kind: vite\n      dir: fe\n      url: http://${abbr}-${slug}.localhost:${port}\n",
      async (config) => {
        expect(await openUrlFor(config, "demo", "fe")).toBe("http://otc-demo.localhost:62060");
      },
    ));
});
