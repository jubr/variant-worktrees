import { describe, expect, it } from "bun:test";
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseToml } from "smol-toml";
import { parse as parseYaml } from "yaml";
import { detectInstances } from "../src/autodetect.js";
import { dotenvFor, loadConfig, openUrlFor, writeRuntime } from "../src/index.js";
import { DEFAULT_OPEN_URL, VariantsConfigSchema } from "../src/schema.js";

/** The example project of the repository: the fixture of these tests. */
const exampleDirectory = fileURLToPath(new URL("../../../example/", import.meta.url));

const withExampleCopy = async (run: (directory: string) => Promise<void>): Promise<void> => {
  const directory = mkdtempSync(join(tmpdir(), "variant-example-"));
  try {
    cpSync(exampleDirectory, directory, {
      recursive: true,
      filter: (source) => !/(^|\/)(node_modules|dist)(\/|$)/.test(source.slice(exampleDirectory.length)),
    });
    await run(directory);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
};

describe("the example project", () => {
  it("has a variants.yaml that validates against the schema", () => {
    const parsed: unknown = parseYaml(readFileSync(join(exampleDirectory, "variants.yaml"), "utf8"));

    expect(VariantsConfigSchema.safeParse(parsed).success).toBe(true);
  });

  it("lists fe (Vite, open) and be (NestJS, dotenv) with a seed command on SQLite", () => {
    const config = loadConfig({ cwd: exampleDirectory });

    expect(config.db.dialect).toBe("sqlite");
    expect(config.variant?.seed).toBe("bun scripts/seed.mjs");
    expect(config.variant.instances).toMatchObject({
      fe: { kind: "vite", dir: "fe", open: DEFAULT_OPEN_URL },
      be: { kind: "nestjs", dir: "be", dotenv: ".env" },
    });
    expect(Object.keys(config.variant.instances)).toEqual(["be", "fe"]);
  });

  it("uses the options for storage, steps, implode, readiness, environment and containers", () => {
    const { variant } = loadConfig({ cwd: exampleDirectory });

    expect(variant.storage).toEqual({ dir: ".storage", env: "STORAGE_ROOT" });
    expect(variant.steps?.map((step) => step.name)).toEqual(["storage"]);
    expect(variant.implode).toMatchObject({ preRm: ["dist", "node_modules", ".cache", "out"], restore: ["bun.lock"] });
    expect(variant.instances.be).toMatchObject({
      ready: "/api",
      env: { PORT: "{{port}}", SQLITE_DATABASE: "{{schema}}" },
      container: { dockerfile: "be/Dockerfile", port: 3000 },
    });
    expect(variant.instances.fe).toMatchObject({
      ready: "/",
      env: { VARIANT_API_PORT: "{{port.be}}" },
      container: { static: "dist", proxy: { path: "/api/", to: "be" } },
    });
  });

  it("ships the Dockerfile that the be container builds", () => {
    expect(existsSync(join(exampleDirectory, "be/Dockerfile"))).toBe(true);
  });

  it("autodetects the same instances the config lists", () => {
    const explicit = Object.values(loadConfig({ cwd: exampleDirectory }).variant.instances).map(({ kind, dir }) => ({
      kind,
      dir,
    }));
    const detected = Object.values(detectInstances(exampleDirectory)).map(({ kind, dir }) => ({ kind, dir }));

    expect(detected).toEqual([...explicit].sort((left, right) => left.dir.localeCompare(right.dir)));
  });

  it("derives be's dotenv from .env.example with the variant's values", () => {
    const config = loadConfig({ cwd: exampleDirectory });
    const be = config.variant.instances.be;
    if (!be) {
      throw new Error("example has no be instance");
    }

    expect(dotenvFor(config, be, { PORT: "62061", SQLITE_DATABASE: "/tmp/demo.db" })).toBe(
      "# Copied to .env for a variant and amended with its PORT and SQLITE_DATABASE.\nPORT=62061\nSQLITE_DATABASE=/tmp/demo.db\n",
    );
  });

  it("opens fe on the port the runtime state assigns", () =>
    withExampleCopy(async (directory) => {
      writeRuntime(directory, { slug: "demo", instances: { fe: { port: 62060 }, be: { port: 62061 } } });
      const config = loadConfig({ cwd: directory });

      expect(await openUrlFor(config, "demo", "fe")).toBe("http://demo.vw.localhost:62060");
      expect(await openUrlFor(config, "demo", "be")).toBeUndefined();
    }));

  it("declares bun in mise.toml and names the variant CLI in a commented-out line", () => {
    const text = readFileSync(join(exampleDirectory, "mise.toml"), "utf8");
    const mise = parseToml(text) as { tools: Record<string, string> };

    expect(Object.keys(mise.tools)).toEqual(["bun"]);
    expect(text).toMatch(/^\s*#\s*"github:jubr\/variant-worktrees"\s*=/m);
  });

  it("ships be/.env.example with SQLite settings and a seed script", () => {
    expect(readFileSync(join(exampleDirectory, "be/.env.example"), "utf8")).toContain("SQLITE_DATABASE=");
    expect(existsSync(join(exampleDirectory, "scripts/seed.mjs"))).toBe(true);
  });
});
