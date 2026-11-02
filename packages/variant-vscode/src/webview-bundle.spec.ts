import { describe, expect, it } from "bun:test";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { bundleWebview } from "../scripts/bundle-webview.ts";

describe("webview bundle", () => {
  it("builds the variants app, with its script and styles, into the directory the panel loads from", async () => {
    const outdir = mkdtempSync(join("/tmp", "variant-vscode-webview-"));
    try {
      await bundleWebview(outdir);

      const files = readdirSync(outdir);
      expect(files).toContain("index.html");
      expect(files.some((file) => file.endsWith(".js"))).toBe(true);
      expect(files.some((file) => file.endsWith(".css"))).toBe(true);
    } finally {
      rmSync(outdir, { recursive: true, force: true });
    }
  });

  it("is listed in .vscodeignore, so the packaged file contains it", () => {
    const ignore = readFileSync(new URL("../.vscodeignore", import.meta.url), "utf8");

    expect(ignore.split("\n")).toContain("!dist/webview/*");
  });
});
