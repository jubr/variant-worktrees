import { describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadConfig } from "variant-config";
import type { OperationContext } from "../src/operations/types.js";
import { prepareRun } from "../src/run-context.js";
import type { DatabaseAdapter } from "../src/types.js";

const withContext = async (
  yaml: string,
  run: (context: OperationContext, directory: string) => Promise<void>,
): Promise<void> => {
  const directory = mkdtempSync(join("/tmp", "variant-run-context-"));
  try {
    writeFileSync(join(directory, "variants.yaml"), yaml);
    const config = loadConfig({ cwd: directory, env: {} });
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
    "  dialect: sqlite",
    "variant:",
    ...(range ? ["  ports:", `    range: "${range}"`] : []),
    "  instances:",
    "    fe: { kind: vite, dir: fe }",
    "    be: { kind: nestjs, dir: be }",
    "    api: { kind: nestjs, dir: api }",
    "",
  ].join("\n");

describe("prepareRun ports", () => {
  it("assigns every instance its own free port of the default range", () =>
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

  it("picks from the configured range, even when it holds exactly as many ports as instances", () =>
    withContext(PROJECT("50000-50002"), async (context, directory) => {
      const run = await prepareRun(context, "demo", directory);

      expect(Object.values(run.ports).sort()).toEqual([50000, 50001, 50002]);
    }));

  it("fails naming the range when it is smaller than the number of instances", () =>
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
