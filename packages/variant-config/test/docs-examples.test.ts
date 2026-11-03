/**
 * Specification: openspec/specs/docs/readmes/spec.md (Configuration examples match the schema)
 */
import { describe, expect, it } from "bun:test";
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { parse as parseYaml } from "yaml";
import { loadConfig } from "../src/index.js";

const repoRoot = join(import.meta.dir, "..", "..", "..");
const TOP_LEVEL_KEYS = ["db", "variant", "variants", "chatRenamer"];

const markdownFiles = (directory: string): string[] =>
  readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    if (name === "node_modules" || name === ".vitepress" || name === "typedoc") {
      return [];
    }
    return statSync(path).isDirectory() ? markdownFiles(path) : path.endsWith(".md") ? [path] : [];
  });

const files = [
  join(repoRoot, "README.md"),
  join(repoRoot, "packages", "variant-vscode", "README.md"),
  ...markdownFiles(join(repoRoot, "docs")),
];

interface Example {
  where: string;
  text: string;
}

/** The `yaml` blocks of a markdown file that show a `variants.yaml`. */
const examplesOf = (path: string): Example[] => {
  const markdown = readFileSync(path, "utf8");
  const examples: Example[] = [];
  for (const match of markdown.matchAll(/```ya?ml[^\n]*\n([\s\S]*?)```/g)) {
    const text = match[1] ?? "";
    let parsed: unknown;
    try {
      parsed = parseYaml(text);
    } catch {
      // a block that is not YAML is not an example of variants.yaml; the other tests of the docs cover it
      continue;
    }
    if (parsed && typeof parsed === "object" && TOP_LEVEL_KEYS.some((key) => key in (parsed as object))) {
      const line = markdown.slice(0, match.index).split("\n").length;
      examples.push({ where: `${relative(repoRoot, path)}:${line}`, text });
    }
  }
  return examples;
};

const examples = files.flatMap(examplesOf);

describe("configuration examples in the READMEs and guides", () => {
  it("finds examples to check", () => {
    expect(examples.length).toBeGreaterThan(0);
  });

  for (const example of examples) {
    it(`${example.where} loads without an error, a warning or a migration`, () => {
      const directory = mkdtempSync(join(tmpdir(), "variant-docs-example-"));
      try {
        writeFileSync(join(directory, "variants.yaml"), example.text);
        const config = loadConfig({ cwd: directory, env: {} });
        expect(config.warnings).toEqual([]);
        expect(config.migrations).toEqual([]);
      } finally {
        rmSync(directory, { recursive: true, force: true });
      }
    });
  }
});
