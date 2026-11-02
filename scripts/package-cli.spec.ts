/**
 * Specification: openspec/specs/meta/release-artifacts/spec.md (Release contents)
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { assetName, compileCli, embeddedAppModule } from "./package-cli.ts";

describe("package-cli assetName", () => {
  test("names a unix executable with version, os and arch", () => {
    expect(assetName("1.2.3", "bun-linux-x64")).toBe("variant-1.2.3-linux-x64");
    expect(assetName("1.2.3", "bun-darwin-arm64")).toBe("variant-1.2.3-darwin-arm64");
  });

  test("gives Windows executables an .exe suffix", () => {
    expect(assetName("1.2.3", "bun-windows-x64")).toBe("variant-1.2.3-windows-x64.exe");
    expect(assetName("1.2.3", "bun-windows-arm64")).toBe("variant-1.2.3-windows-arm64.exe");
  });

  test("rejects a target that is not a release platform", () => {
    expect(() => assetName("1.2.3", "bun-linux-x64-baseline")).toThrow("unsupported target");
    expect(() => assetName("1.2.3", "bun-freebsd-x64")).toThrow("unsupported target");
  });
});

describe("package-cli embeddedAppModule", () => {
  test("imports every file of the app as an embedded file and maps its name to it", () => {
    const directory = mkdtempSync(join("/tmp", "variant-app-"));
    try {
      writeFileSync(join(directory, "index.html"), "<html>");
      writeFileSync(join(directory, "chunk-abc.js"), "1");
      mkdirSync(join(directory, "nested"));

      const module = embeddedAppModule(directory);

      expect(module).toContain(`from ${JSON.stringify(join(directory, "index.html"))} with { type: "file" }`);
      expect(module).toContain(`from ${JSON.stringify(join(directory, "chunk-abc.js"))} with { type: "file" }`);
      expect(module).toMatch(/export const embeddedApp = \{ .*"index\.html": file\d.*\};/);
      expect(module).not.toContain("nested");
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  test("compiling fails, saying so, when the app is not built", async () => {
    const root = mkdtempSync(join("/tmp", "variant-root-"));
    try {
      await expect(compileCli(root, join(root, "variant"))).rejects.toThrow("the variants app is not built");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
