import { describe, expect, it } from "bun:test";
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseToml } from "smol-toml";
import { parse as parseYaml } from "yaml";
import { detectInstances } from "../src/autodetect.js";
import { dotenvFor, loadConfig, openUrlFor, writeRuntime } from "../src/index.js";
import { DEFAULT_URL, VariantsConfigSchema } from "../src/schema.js";

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

  it("lists fe (Vite, url) and be (NestJS, env.sourceFile) with a seed command on SQLite", () => {
    const config = loadConfig({ cwd: exampleDirectory });

    expect(config.db.dialect).toBe("sqlite");
    expect(config.variant?.seed).toBe("bun scripts/seed.mjs");
    expect(config.variant.instances).toMatchObject({
      fe: { kind: "vite", dir: "fe", url: DEFAULT_URL },
      be: { kind: "nestjs", dir: "be", env: { sourceFile: ".env" } },
    });
    expect(Object.keys(config.variant.instances)).toEqual(["be", "fe"]);
  });

  it("uses the options for storage, steps, implode, readiness, environment and containers", () => {
    const { variant } = loadConfig({ cwd: exampleDirectory });

    expect(variant.storage).toEqual({ dir: ".storage", envVarName: "STORAGE_ROOT" });
    expect(variant.steps?.map((step) => step.name)).toEqual(["storage"]);
    expect(variant.implode).toMatchObject({ preRm: ["dist", "node_modules", ".cache", "out"], discard: ["bun.lock"] });
    expect(variant.instances.be).toMatchObject({
      ready: "/api",
      env: { sourceFile: ".env", overrides: { PORT: "{{port}}", SQLITE_DATABASE: "{{schema}}" } },
      container: { dockerfile: "be/Dockerfile", internalPort: 3000 },
    });
    expect(variant.instances.fe).toMatchObject({
      ready: "/",
      env: { overrides: { PORT: "{{port}}", VARIANT_API_PORT: "{{be.port}}" } },
      container: { dockerfile: "fe/Dockerfile" },
    });
  });

  it("ships the Dockerfile of every container, and the fe one serves with nginx:alpine and proxies to be", () => {
    const { variant } = loadConfig({ cwd: exampleDirectory });

    for (const instance of Object.values(variant.instances)) {
      expect(existsSync(join(exampleDirectory, instance.container?.dockerfile ?? "missing"))).toBe(true);
    }
    const fe = readFileSync(join(exampleDirectory, "fe/Dockerfile"), "utf8");
    const template = readFileSync(join(exampleDirectory, "fe/nginx.conf.template"), "utf8");

    expect(fe).toMatch(/^FROM nginx:alpine$/m);
    expect(template).toMatch(/proxy_pass http:\/\/v-be-\$\{VARIANT_SLUG\}:3000\/api\/;/);
  });

  it("autodetects the same instances the config lists", () => {
    const explicit = Object.values(loadConfig({ cwd: exampleDirectory }).variant.instances).map(({ kind, dir }) => ({
      kind,
      dir,
    }));
    const detected = Object.values(detectInstances(exampleDirectory)).map(({ kind, dir }) => ({ kind, dir }));

    expect(detected).toEqual([...explicit].sort((left, right) => left.dir.localeCompare(right.dir)));
  });

  it("derives be's env file from .env.example with the variant's values", () => {
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

  it("declares bun in mise.toml and names the variant CLI, active or commented out", () => {
    const text = readFileSync(join(exampleDirectory, "mise.toml"), "utf8");
    const mise = parseToml(text) as { tools: Record<string, string> };

    expect(Object.keys(mise.tools).filter((tool) => tool !== "github:jubr/variant-worktrees")).toEqual(["bun"]);
    expect(text).toMatch(/^\s*#?\s*"github:jubr\/variant-worktrees"\s*=/m);
  });

  it("keeps the console across rebuilds in the dev servers of fe and be", () => {
    const vite = readFileSync(join(exampleDirectory, "fe/vite.config.ts"), "utf8");
    const be = JSON.parse(readFileSync(join(exampleDirectory, "be/package.json"), "utf8")) as {
      scripts: Record<string, string>;
    };
    const tsconfig = JSON.parse(readFileSync(join(exampleDirectory, "be/tsconfig.json"), "utf8")) as {
      compilerOptions: Record<string, unknown>;
    };

    expect(vite).toMatch(/clearScreen:\s*false/);
    expect(be.scripts["start:dev"]).toContain("--no-clear-screen");
    expect(tsconfig.compilerOptions.preserveWatchOutput).toBe(true);
  });

  it("ships be/.env.example with SQLite settings and a seed script", () => {
    expect(readFileSync(join(exampleDirectory, "be/.env.example"), "utf8")).toContain("SQLITE_DATABASE=");
    expect(existsSync(join(exampleDirectory, "scripts/seed.mjs"))).toBe(true);
  });
});
