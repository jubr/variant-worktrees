import { describe, expect, it } from "bun:test";
import { execFileSync } from "node:child_process";
import { cpSync, mkdtempSync, rmSync } from "node:fs";
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
        "node",
        [
          "--no-warnings",
          "-e",
          'const { DatabaseSync } = require("node:sqlite"); const database = new DatabaseSync(process.env.DB); console.log(JSON.stringify(database.prepare("SELECT text FROM notes ORDER BY id").all()));',
        ],
        { env: { ...process.env, DB: created.target }, encoding: "utf8" },
      );
      expect(JSON.parse(rows)).toEqual([{ text: "hello from the seed" }, { text: "variant: demo" }]);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
