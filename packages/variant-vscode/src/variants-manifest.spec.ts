import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";

interface Manifest {
  engines: { vscode: string };
  dependencies: Record<string, string>;
  contributes: {
    commands: Array<{ command: string; title: string }>;
    views?: Record<string, Array<{ id: string; name: string; when?: string; visibility?: string }>>;
    viewsWelcome?: Array<{ view: string; contents: string; when?: string }>;
    menus?: Record<string, Array<{ command: string; when?: string; group?: string }>>;
  };
}

const manifest: Manifest = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const build = readFileSync(new URL("../scripts/esbuild.config.ts", import.meta.url), "utf8");

describe("variants view manifest", () => {
  describe("host requirement", () => {
    it("needs VS Code 1.101, whose Node.js reads sqlite through node:sqlite", () => {
      expect(manifest.engines.vscode).toBe("^1.101.0");
    });

    it("types against no newer API than that", () => {
      expect(manifest.dependencies["@types/vscode"]).toBe("^1.101.0");
    });

    it("bundles for Node 22", () => {
      expect(build).toContain('target: "node22"');
    });

    it("embeds the library and the app, not the server", () => {
      expect(manifest.dependencies["variant-api"]).toBe("workspace:*");
      expect(manifest.dependencies["variant-ui"]).toBe("workspace:*");
      expect(manifest.dependencies["variant-server"]).toBeUndefined();
    });
  });
});
