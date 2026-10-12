import { describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadConfig, openUrlFor, resolveInstancePort } from "../src/index.js";
import { DEFAULT_OPEN_URL, type VariantInstance } from "../src/schema.js";

const vite: VariantInstance = { name: "fe", kind: "vite", dir: "fe", open: DEFAULT_OPEN_URL };
const nestjs: VariantInstance = { name: "be", kind: "nestjs", dir: "be" };

const withProject = async (local: string | undefined, run: (directory: string) => Promise<void>): Promise<void> => {
  const directory = mkdtempSync(join("/tmp", "variant-ports-"));
  try {
    writeFileSync(join(directory, "variants.yaml"), "db:\n  dialect: sqlite\n");
    if (local !== undefined) {
      writeFileSync(join(directory, "variants.local.yaml"), local);
    }
    await run(directory);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
};

const assigned =
  "runtime:\n  instances:\n    fe:\n      port: 62060\n    be:\n      port: 62061\n    vite:\n      port: 62062\n";

describe("resolveInstancePort", () => {
  it("reads the port of the instance's name from the runtime state", () =>
    withProject(assigned, async (directory) => {
      const config = loadConfig({ cwd: directory });

      expect(await resolveInstancePort(config, vite)).toBe(62060);
      expect(await resolveInstancePort(config, nestjs)).toBe(62061);
    }));

  it("keys an unnamed instance by its kind", () =>
    withProject(assigned, async (directory) => {
      const unnamed: VariantInstance = { kind: "vite", dir: "fe" };

      expect(await resolveInstancePort(loadConfig({ cwd: directory }), unnamed)).toBe(62062);
    }));

  it("picks a random free port when the runtime state has none", () =>
    withProject(undefined, async (directory) => {
      const port = await resolveInstancePort(loadConfig({ cwd: directory }), vite);

      expect(Number.isInteger(port)).toBe(true);
      expect(port).toBeGreaterThanOrEqual(1024);
      expect(port).toBeLessThanOrEqual(65535);
    }));
});

describe("openUrlFor", () => {
  it("replaces {{slug}} and {{port}} in the instance template", () =>
    withProject(assigned, async (directory) => {
      expect(await openUrlFor(loadConfig({ cwd: directory }), "add-auth", vite)).toBe(
        "http://add-auth.vw.localhost:62060",
      );
    }));

  it("returns nothing for an instance without a template", () =>
    withProject(undefined, async (directory) => {
      expect(await openUrlFor(loadConfig({ cwd: directory }), "add-auth", nestjs)).toBeUndefined();
    }));
});
