import { describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadConfig, openUrlFor, resolveInstancePort } from "../src/index.js";
import { DEFAULT_OPEN_URL, type VariantInstance } from "../src/schema.js";

const vite: VariantInstance = { kind: "vite", dir: "fe", open: DEFAULT_OPEN_URL };
const nestjs: VariantInstance = { kind: "nestjs", dir: "be" };

const withProject = async (
  yaml: string,
  files: Record<string, string>,
  run: (directory: string) => Promise<void>,
): Promise<void> => {
  const directory = mkdtempSync(join("/tmp", "variant-ports-"));
  try {
    writeFileSync(join(directory, "variants.yaml"), `db:\n  dialect: sqlite\n${yaml}`);
    for (const [path, content] of Object.entries(files)) {
      mkdirSync(join(directory, path, ".."), { recursive: true });
      writeFileSync(join(directory, path), content);
    }
    await run(directory);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
};

describe("cacheDir", () => {
  it("defaults to .cache/variants below the config directory", () =>
    withProject("", {}, async (directory) => {
      expect(loadConfig({ cwd: directory }).variant?.cacheDir).toBe(join(directory, ".cache/variants"));
    }));

  it("resolves a configured cacheDir against the config directory", () =>
    withProject("variant:\n  cacheDir: state\n", {}, async (directory) => {
      expect(loadConfig({ cwd: directory }).variant?.cacheDir).toBe(join(directory, "state"));
    }));
});

describe("resolveInstancePort", () => {
  const assigned = 'slug: demo\nspa_port: "62060"\napi_port: 62061\n';

  it("reads spa_port for Vite and api_port for NestJS from the state file", () =>
    withProject("", { ".cache/variants/demo.yaml": assigned }, async (directory) => {
      const config = loadConfig({ cwd: directory });

      expect(await resolveInstancePort(config, "demo", vite)).toBe(62060);
      expect(await resolveInstancePort(config, "demo", nestjs)).toBe(62061);
    }));

  it("reads the state file from a configured cacheDir", () =>
    withProject("variant:\n  cacheDir: state\n", { "state/demo.yaml": assigned }, async (directory) => {
      expect(await resolveInstancePort(loadConfig({ cwd: directory }), "demo", vite)).toBe(62060);
    }));

  it("picks a random free port when the slug has no state file", () =>
    withProject("", {}, async (directory) => {
      const port = await resolveInstancePort(loadConfig({ cwd: directory }), "demo", vite);

      expect(Number.isInteger(port)).toBe(true);
      expect(port).toBeGreaterThanOrEqual(1024);
      expect(port).toBeLessThanOrEqual(65535);
    }));

  it("picks a random port when the state file is invalid or names no usable port", () =>
    withProject(
      "",
      { ".cache/variants/bad.yaml": "spa_port: [unclosed", ".cache/variants/text.yaml": "spa_port: soon\n" },
      async (directory) => {
        const config = loadConfig({ cwd: directory });

        expect(await resolveInstancePort(config, "bad", vite)).toBeGreaterThanOrEqual(1024);
        expect(await resolveInstancePort(config, "text", vite)).toBeGreaterThanOrEqual(1024);
      },
    ));
});

describe("openUrlFor", () => {
  it("replaces {{slug}} and {{port}} in the instance template", () =>
    withProject("", { ".cache/variants/add-auth.yaml": 'spa_port: "62060"\n' }, async (directory) => {
      const config = loadConfig({ cwd: directory });

      expect(await openUrlFor(config, "add-auth", vite)).toBe("http://add-auth.vw.localhost:62060");
    }));

  it("returns nothing for an instance without a template", () =>
    withProject("", {}, async (directory) => {
      expect(await openUrlFor(loadConfig({ cwd: directory }), "add-auth", nestjs)).toBeUndefined();
    }));
});
