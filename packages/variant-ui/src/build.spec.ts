import { describe, expect, it } from "bun:test";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { buildApp } from "../scripts/build.js";

describe("the app build", () => {
  it("produces a static index.html with its script and styles", async () => {
    const outdir = mkdtempSync(join("/tmp", "variant-ui-build-"));
    try {
      await buildApp(outdir);

      const files = readdirSync(outdir);
      const html = readFileSync(join(outdir, "index.html"), "utf8");
      expect(files.some((file) => file.endsWith(".js"))).toBe(true);
      expect(files.some((file) => file.endsWith(".css"))).toBe(true);
      expect(html).toContain('id="root"');
      expect(html).toMatch(/<script[^>]+src="\.\/[^"]+\.js"/);
    } finally {
      rmSync(outdir, { recursive: true, force: true });
    }
  });
});
