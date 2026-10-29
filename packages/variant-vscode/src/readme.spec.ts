import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Specification: openspec/specs/docs/readmes/spec.md
 */

const repoRoot = join(import.meta.dirname, "../../..");
const read = (file: string): string => readFileSync(join(repoRoot, file), "utf8");

const description = "Isolated tree+db for your agents :: watch, seed, implode";
const docsUrl = "https://jubr.github.io/variant-worktrees/";

const readmes = [
  { name: "repository README", text: read("README.md") },
  { name: "extension README", text: read("packages/variant-vscode/README.md") },
] as const;

/** Text before the first second-level heading. */
const intro = (text: string): string => text.split(/^## /m)[0] ?? "";

const headings = (text: string): string[] => [...text.matchAll(/^## (.+)$/gm)].map((match) => match[1] ?? "");

describe("extension description", () => {
  it("is the marketplace tagline", () => {
    const manifest = JSON.parse(read("packages/variant-vscode/package.json")) as { description: string };
    expect(manifest.description).toBe(description);
  });
});

for (const { name, text } of readmes) {
  describe(name, () => {
    it("shows the tagline before the first second-level heading", () => {
      expect(intro(text)).toContain(description);
    });

    it("links to the online documentation before the first second-level heading", () => {
      expect(intro(text)).toContain(docsUrl);
    });

    it("tells why before how", () => {
      expect(headings(text)[0]).toBe("Why");
      const afterWhy = text.slice(text.indexOf("## Why"));
      expect(afterWhy).toContain("variant watch");
      expect(text).toContain("variant implode");
    });
  });
}

describe("extension README", () => {
  const text = read("packages/variant-vscode/README.md");

  it("has no development information", () => {
    for (const forbidden of ["bun install", "bun run", "bun test", "F5", "Extension Development Host"]) {
      expect(text).not.toContain(forbidden);
    }
    expect(headings(text)).not.toContain("Development");
  });

  it("covers configuration, the MCP server, and the chat renamer", () => {
    for (const expected of ["variants.yaml", "variant-mcp", "/chat-rename"]) {
      expect(text).toContain(expected);
    }
  });
});

describe("repository README", () => {
  const text = read("README.md");

  it("says how to install the CLI and points contributors to CONTRIBUTING.md", () => {
    expect(text).toContain("mise use github:jubr/variant-worktrees");
    expect(text).toContain("CONTRIBUTING.md");
    expect(text).not.toContain("task lint");
  });
});
