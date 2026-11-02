import { describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import esbuild from "esbuild";
import config from "../scripts/esbuild.config.ts";

/**
 * Specification: openspec/changes/vscode-view/specs/variant-vscode/variants-tree/spec.md
 *
 * The extension is one CommonJS file, so a dependency that reads `import.meta.url` must still load in it.
 */
describe("the extension bundle", () => {
  it("loads variant-api under Node, dependencies that read import.meta.url included, and lists a project", async () => {
    const directory = mkdtempSync(join("/tmp", "variant-bundle-"));
    try {
      writeFileSync(join(directory, "variants.yaml"), "db:\n  dialect: sqlite\n");
      const { entryPoints: _entry, outdir: _outdir, outbase: _outbase, outExtension: _ext, ...shared } = config;
      const outfile = join(directory, "probe.cjs");
      await esbuild.build({
        ...shared,
        stdin: {
          contents: `import("variant-api").then(async (m) => {
            const records = await m.createClient({ cwd: ${JSON.stringify(directory)}, worktree: false }).list();
            console.log(Array.isArray(records) ? typeof m.createClient : "no list");
          });`,
          resolveDir: join(import.meta.dir, ".."),
          loader: "ts",
        },
        outfile,
        logLevel: "silent",
      });

      const run = Bun.spawn(["node", outfile], { stdout: "pipe", stderr: "pipe" });
      const [code, out, err] = await Promise.all([
        run.exited,
        new Response(run.stdout).text(),
        new Response(run.stderr).text(),
      ]);

      expect(err).toBe("");
      expect(out.trim()).toBe("function");
      expect(code).toBe(0);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  }, 60_000);
});
