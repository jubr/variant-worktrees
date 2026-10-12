import { describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadConfig } from "variant-config";
import { createClient } from "../src/index.js";

const tempDirectory = (): string => realpathSync(mkdtempSync(join("/tmp", "variant-provision-")));

describe("provision", () => {
  it("runs each instance's up command in its dir and the seed in the worktree root", async () => {
    const directory = tempDirectory();
    try {
      mkdirSync(join(directory, "be"));
      mkdirSync(join(directory, "fe"));
      writeFileSync(
        join(directory, "variants.yaml"),
        [
          "db:",
          "  dialect: sqlite",
          "variant:",
          "  seed: pwd > seed.out",
          "  instances:",
          "    - { name: fe, kind: vite, dir: fe, up: pwd > ../fe.out }",
          "    - { name: be, kind: nestjs, dir: be, up: pwd > ../be.out }",
          "",
        ].join("\n"),
      );
      const client = createClient({
        config: loadConfig({ cwd: directory }),
        cwd: directory,
        stateDir: join(directory, ".cache", "variants"),
        worktree: false,
      });

      await client.provision("demo");

      expect(readFileSync(join(directory, "fe.out"), "utf8").trim()).toBe(join(directory, "fe"));
      expect(readFileSync(join(directory, "be.out"), "utf8").trim()).toBe(join(directory, "be"));
      expect(readFileSync(join(directory, "seed.out"), "utf8").trim()).toBe(directory);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
