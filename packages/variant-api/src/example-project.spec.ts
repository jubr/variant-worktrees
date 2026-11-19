import { describe, expect, it } from "bun:test";
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "variant-config";
import { createVariantClient } from "./index.js";

/** The example project of the repository: the fixture of this test. */
const exampleDirectory = fileURLToPath(new URL("../../../example/", import.meta.url));

describe("the example project", () => {
  it("creates a variant database that its seed script fills", async () => {
    const directory = mkdtempSync(join(tmpdir(), "variant-example-api-"));
    try {
      cpSync(exampleDirectory, directory, {
        recursive: true,
        filter: (source) => !/(^|\/)(node_modules|dist)(\/|$)/.test(source.slice(exampleDirectory.length)),
      });
      const config = loadConfig({ cwd: directory });
      const client = createVariantClient({
        config,
        cwd: directory,
        stateDir: join(directory, ".cache", "variants"),
        worktree: false,
      });

      const created = await client.create("demo");
      expect(created.target).toBe(join(directory, ".cache", "variants", "demo.db"));

      const seed = config.variant.steps.seed?.cmd;
      expect(seed).toBeDefined();
      // `create` makes no database file, so nothing made the directory yet: `provision` does, and here the seed runs by hand.
      mkdirSync(dirname(created.target), { recursive: true });
      execFileSync("sh", ["-c", seed as string], {
        cwd: directory,
        env: { ...process.env, SQLITE_DATABASE: created.target, VARIANT_SLUG: "demo" },
        stdio: "ignore",
      });
      const rows = execFileSync(
        process.execPath,
        [
          "-e",
          'const { Database } = require("bun:sqlite"); console.log(JSON.stringify(new Database(process.env.DB).query("SELECT text FROM notes ORDER BY id").all()));',
        ],
        { env: { ...process.env, DB: created.target }, encoding: "utf8" },
      );
      expect(JSON.parse(rows)).toEqual([{ text: "hello from the seed" }, { text: "variant: demo" }]);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("provisions a variant: storage, the step and the seed", async () => {
    const directory = mkdtempSync(join(tmpdir(), "variant-example-provision-"));
    try {
      cpSync(exampleDirectory, directory, {
        recursive: true,
        filter: (source) => !/(^|\/)(node_modules|dist)(\/|$)/.test(source.slice(exampleDirectory.length)),
      });
      const client = createVariantClient({
        config: loadConfig({ cwd: directory, env: {} }),
        cwd: directory,
        stateDir: join(directory, ".cache", "variants"),
        worktree: false,
      });
      const created = await client.create("demo");

      const result = await client.provision("demo");

      expect(result.output).toContain(`Preparing demo with storage in ${join(directory, ".storage")}`);
      expect(existsSync(join(directory, ".storage"))).toBe(true);
      expect(result.commands).toContain("bun scripts/seed.mjs");
      const rows = execFileSync(
        process.execPath,
        [
          "-e",
          'const { Database } = require("bun:sqlite"); console.log(new Database(process.env.DB).query("SELECT COUNT(*) AS n FROM notes").get().n);',
        ],
        { env: { ...process.env, DB: created.target }, encoding: "utf8" },
      );
      expect(Number(rows)).toBe(2);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
