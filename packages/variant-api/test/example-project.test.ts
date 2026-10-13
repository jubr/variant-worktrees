import { describe, expect, it } from "bun:test";
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "variant-config";
import { createClient } from "../src/index.js";

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
      const client = createClient({
        config,
        cwd: directory,
        stateDir: join(directory, ".cache", "variants"),
        worktree: false,
      });

      const created = await client.create("demo");
      expect(created.target).toBe(join(directory, ".cache", "variants", "demo.db"));

      const seed = config.variant?.seed;
      expect(seed).toBeDefined();
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
      const client = createClient({
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
