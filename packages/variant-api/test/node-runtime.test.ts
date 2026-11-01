/**
 * Specification: openspec/specs/variant-api/node-runtime/spec.md
 *
 * These tests run the built library (`dist/`) in a child process: `bun run test` builds `variant-api` first.
 */
import { describe, expect, it } from "bun:test";
import { mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const dist = join(import.meta.dir, "../dist");
const entries = {
  index: pathToFileURL(join(dist, "index.js")).href,
  commands: pathToFileURL(join(dist, "commands.js")).href,
};

/** Runs an ES module `script` under `runtime` and returns what it printed. */
const run = async (
  runtime: "node" | "bun",
  script: string,
): Promise<{ stdout: string; stderr: string; exitCode: number }> => {
  const command = runtime === "node" ? ["node", "--input-type=module", "-e", script] : ["bun", "-e", script];
  const proc = Bun.spawn(command, { stdout: "pipe", stderr: "pipe", env: { ...process.env, VARIANT_WORKTREE: "0" } });
  const [exitCode, stdout, stderr] = await Promise.all([
    proc.exited,
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  return { stdout, stderr, exitCode };
};

describe("variant-api on Node and Bun", () => {
  for (const runtime of ["node", "bun"] as const) {
    it(`imports the built library and its commands under ${runtime}`, async () => {
      const result = await run(
        runtime,
        `const api = await import(${JSON.stringify(entries.index)});
         const commands = await import(${JSON.stringify(entries.commands)});
         console.log(typeof api.createClient, typeof commands.commands);`,
      );
      expect(result.stderr).toBe("");
      expect(result.stdout.trim()).toBe("function object");
      expect(result.exitCode).toBe(0);
    });
  }

  for (const runtime of ["node", "bun"] as const) {
    it(`creates, lists and removes a SQLite variant under ${runtime}`, async () => {
      const directory = realpathSync(mkdtempSync(join("/tmp", "variant-node-sqlite-")));
      try {
        writeFileSync(join(directory, "variants.yaml"), "db:\n  dialect: sqlite\n");
        const result = await run(
          runtime,
          `import { existsSync } from "node:fs";
           const { createClient } = await import(${JSON.stringify(entries.index)});
           const client = createClient({ cwd: ${JSON.stringify(directory)}, configPath: ${JSON.stringify(join(directory, "variants.yaml"))}, worktree: false });
           const file = ${JSON.stringify(join(directory, ".cache/variants/test-feature.db"))};
           await client.create("test-feature");
           const created = existsSync(file);
           const listed = (await client.list()).map((record) => record.slug);
           await client.implode("test-feature");
           console.log(JSON.stringify({ created, listed, removed: !existsSync(file), after: (await client.list()).map((record) => record.slug) }));`,
        );
        expect(result.stderr).toBe("");
        expect(JSON.parse(result.stdout)).toEqual({
          created: true,
          listed: ["test-feature"],
          removed: true,
          after: [],
        });
      } finally {
        rmSync(directory, { recursive: true, force: true });
      }
    });
  }

  it("loads no sqlite module when a PostgreSQL client is used under Node", async () => {
    const directory = realpathSync(mkdtempSync(join("/tmp", "variant-node-pg-")));
    try {
      writeFileSync(
        join(directory, "variants.yaml"),
        "db:\n  dialect: postgres\n  url: postgres://u:p@127.0.0.1:1/db\n",
      );
      const result = await run(
        "node",
        `const { createClient } = await import(${JSON.stringify(entries.index)});
         const client = createClient({ cwd: ${JSON.stringify(directory)}, configPath: ${JSON.stringify(join(directory, "variants.yaml"))}, worktree: false });
         await client.list().catch(() => undefined);
         console.log(process.moduleLoadList.filter((name) => name.includes("sqlite")).length);`,
      );
      expect(result.stdout.trim()).toBe("0");
      expect(result.exitCode).toBe(0);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
