import { describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadConfig } from "variant-config";
import { createClient } from "../src/index.js";

const withProject = async (instance: string, run: (log: string[], watch: () => Promise<unknown>) => Promise<void>) => {
  const directory = realpathSync(mkdtempSync(join("/tmp", "variant-watch-warning-")));
  try {
    mkdirSync(join(directory, "be"));
    writeFileSync(
      join(directory, "variants.yaml"),
      `db:\n  dialect: sqlite\nvariant:\n  open: false\n  instances:\n    be: { kind: nestjs, dir: be${instance} }\n`,
    );
    const client = createClient({
      config: loadConfig({ cwd: directory, env: {} }),
      cwd: directory,
      stateDir: join(directory, ".cache", "variants"),
      worktree: false,
    });
    const log: string[] = [];
    await run(log, () => client.watch("demo", { detach: true, log: (line) => log.push(line) }));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
};

describe("watch without commands", () => {
  it("warns that nothing was started and names the ways to set a command", () =>
    withProject("", async (log, watch) => {
      await watch();

      const warning = log.find((line) => line.includes("nothing was started"));
      expect(warning).toBeDefined();
      expect(warning).toContain("watch");
      expect(warning).toContain("variant.watch");
    }));

  it("does not warn when an instance has a watch command", () =>
    withProject(", watch: sleep 0", async (log, watch) => {
      await watch();

      expect(log.some((line) => line.includes("nothing was started"))).toBe(false);
    }));
});
