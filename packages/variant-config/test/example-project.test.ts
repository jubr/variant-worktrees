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
    expect(Object.keys(config.variant.instances)).toEqual(["fe", "be"]);
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

  it("declares bun and the variant CLI in mise.toml", () => {
    const mise = parseToml(readFileSync(join(exampleDirectory, "mise.toml"), "utf8")) as {
      tools: Record<string, string>;
    };

    expect(Object.keys(mise.tools)).toEqual(["bun", "github:jubr/variant-worktrees"]);
  });

  it("ships be/.env.example with SQLite settings and a seed script", () => {
    expect(readFileSync(join(exampleDirectory, "be/.env.example"), "utf8")).toContain("SQLITE_DATABASE=");
    expect(existsSync(join(exampleDirectory, "scripts/seed.mjs"))).toBe(true);
  });
});
