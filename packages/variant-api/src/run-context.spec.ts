import { describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { basename, join, relative } from "node:path";
import { loadConfig } from "variant-config";
import type { OperationContext } from "./operations/types.js";
import { commandEnvironment, expandSetting, prepareRun, variantVariables } from "./run-context.js";
import type { DatabaseAdapter } from "./types.js";

const withContext = async (
  yaml: string,
  run: (context: OperationContext, directory: string) => Promise<void>,
): Promise<void> => {
  const directory = mkdtempSync(join("/tmp", "variant-run-context-"));
  try {
    writeFileSync(join(directory, "variants.yaml"), yaml);
    const config = loadConfig({ cwd: directory, env: {}, environment: () => ({}) });
    const adapter = { target: (slug: string) => `v_${slug}` } as unknown as DatabaseAdapter;
    await run(
      {
        config,
        variantRoot: directory,
        stateDir: join(directory, ".cache"),
        cwd: directory,
        useWorktree: false,
        adapter,
      },
      directory,
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
};

const PROJECT = (range?: string): string =>
  [
    "db:",
    "  type: sqlite",
    "variant:",
    ...(range ? ["  ports:", `    range: "${range}"`] : []),
    "  watches:",
    "    fe: { kind: vite, dir: fe }",
    "    be: { kind: nestjs, dir: be }",
    "    api: { kind: nestjs, dir: api }",
    "",
  ].join("\n");

const SQLITE_OVERRIDE = "${worktree}/.cache/variant/${schema}.sqlite";

describe("prepareRun worktree", () => {
  it("normalizes a relative worktree with dot segments and a trailing separator to an absolute path", () =>
    withContext(PROJECT(), async (context, directory) => {
      const relativeWorktree = `${relative(process.cwd(), directory)}/./`;
      const run = await prepareRun(context, "demo", relativeWorktree);

      expect(run.worktree).toBe(directory);
      expect(expandSetting(context.config, run, SQLITE_OVERRIDE, "env.overrides.SQLITE_DATABASE", "be")).toBe(
        `${directory}/.cache/variant/v_demo.sqlite`,
      );
    }));

  it("hands a watch an absolute SQLITE_DATABASE even when the worktree was spelled relatively", () =>
    withContext(PROJECT(), async (context, directory) => {
      const run = await prepareRun(context, "demo", `${relative(process.cwd(), directory)}/../${basename(directory)}`);
      const environment = commandEnvironment(context.config, run, { SQLITE_DATABASE: SQLITE_OVERRIDE }, "be");

      expect(environment.SQLITE_DATABASE).toBe(`${directory}/.cache/variant/v_demo.sqlite`);
    }));
});

describe("MySQL database of a variant", () => {
  const MYSQL = "db:\n  type: mysql\n  host: h\n  database: project_x__${schema}\nvariant:\n  abbr: vw\n";

  it("hands the commands the database of the variant as MYSQL_DATABASE, and its schema name as MYSQL_SCHEMA", () =>
    withContext(MYSQL, async (context, directory) => {
      const run = await prepareRun(context, "demo", directory);
      const variables = variantVariables(context.config, run);

      expect(variables.MYSQL_DATABASE).toBe("project_x__v_demo");
      expect(variables.MYSQL_SCHEMA).toBe("v_demo");
    }));

  it("gives main the schema name `main`, so its database is project_x__main", () =>
    withContext(MYSQL, async (context, directory) => {
      const run = await prepareRun(context, "main", directory);

      expect(run.target).toBe("main");
      expect(variantVariables(context.config, run).MYSQL_DATABASE).toBe("project_x__main");
    }));

  it("keeps the configured schema of main", () =>
    withContext(MYSQL.replace("  host: h\n", "  host: h\n  schema: shared\n"), async (context, directory) => {
      const run = await prepareRun(context, "main", directory);

      expect(variantVariables(context.config, run).MYSQL_DATABASE).toBe("project_x__shared");
    }));

  it("keeps MYSQL_DATABASE as configured without ${schema}", () =>
    withContext("db:\n  type: mysql\n  host: h\n  database: shop\n", async (context, directory) => {
      const run = await prepareRun(context, "demo", directory);

      expect(variantVariables(context.config, run).MYSQL_DATABASE).toBe("shop");
    }));
});

describe("prepareRun ports", () => {
  it("assigns every watch its own free port of the default range", () =>
    withContext(PROJECT(), async (context, directory) => {
      const run = await prepareRun(context, "demo", directory);
      const ports = Object.values(run.ports);

      expect(ports).toHaveLength(3);
      expect(new Set(ports).size).toBe(3);
      for (const port of ports) {
        expect(port).toBeGreaterThanOrEqual(42000);
        expect(port).toBeLessThanOrEqual(42999);
      }
    }));

  it("picks from the configured range, even when it holds exactly as many ports as watches", () =>
    withContext(PROJECT("50000-50002"), async (context, directory) => {
      const run = await prepareRun(context, "demo", directory);

      expect(Object.values(run.ports).sort()).toEqual([50000, 50001, 50002]);
    }));

  it("fails naming the range when it is smaller than the number of watches", () =>
    withContext(PROJECT("50000-50001"), async (context, directory) => {
      await expect(prepareRun(context, "demo", directory)).rejects.toThrow("50000-50001");
    }));

  it("keeps an assigned port wherever it lies", () =>
    withContext(PROJECT("50000-50002"), async (context, directory) => {
      const run = await prepareRun(context, "demo", directory, { fe: 3000 });

      expect(run.ports.fe).toBe(3000);
      expect(run.ports.be).toBeGreaterThanOrEqual(50000);
      expect(run.ports.api).toBeGreaterThanOrEqual(50000);
    }));
});
