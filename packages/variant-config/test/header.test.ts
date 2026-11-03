/**
 * Specification: openspec/specs/variant-config/core/spec.md (Schema header)
 */
import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  addSchemaHeader,
  clearRuntime,
  findSchemaHeader,
  isSchemaHeaderNotice,
  schemaHeaderFor,
  schemaHeaderNotice,
  writeRuntime,
} from "../src/index.js";

const MAIN =
  "# yaml-language-server: $schema=https://github.com/jubr/variant-worktrees/raw/refs/heads/main/packages/variant-config/variants.yaml.schema.json";
const LOCAL =
  "# yaml-language-server: $schema=https://github.com/jubr/variant-worktrees/raw/refs/heads/main/packages/variant-config/variants.local.yaml.schema.json";

const directories: string[] = [];
const temp = (): string => {
  const directory = mkdtempSync(join("/tmp", "variant-header-"));
  directories.push(directory);
  return directory;
};
afterEach(() => {
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("schemaHeaderFor", () => {
  it("is the modeline of the main schema for variants.yaml", () => {
    expect(schemaHeaderFor("variants.yaml")).toBe(MAIN);
    expect(schemaHeaderFor("variants.yml")).toBe(MAIN);
  });

  it("is the modeline of the local schema for variants.local.yaml", () => {
    expect(schemaHeaderFor("variants.local.yaml")).toBe(LOCAL);
  });
});

describe("addSchemaHeader", () => {
  it("puts the modeline and a blank line on top of a file without one", () => {
    expect(addSchemaHeader("variant:\n  open: false\n", "variants.yaml")).toBe(`${MAIN}\n\nvariant:\n  open: false\n`);
  });

  it("uses the local schema for variants.local.yaml", () => {
    expect(addSchemaHeader("runtime:\n  slug: a\n", "variants.local.yaml")).toBe(`${LOCAL}\n\nruntime:\n  slug: a\n`);
  });

  it("keeps comments that start the file below the modeline", () => {
    expect(addSchemaHeader("# my project\nvariant: {}\n", "variants.yaml")).toBe(
      `${MAIN}\n\n# my project\nvariant: {}\n`,
    );
  });

  it("leaves a file alone that has a schema line, whatever its URL", () => {
    const text = "# yaml-language-server: $schema=./packages/variant-config/variants.yaml.schema.json\n\nvariant: {}\n";

    expect(addSchemaHeader(text, "variants.yaml")).toBeUndefined();
    expect(findSchemaHeader(text)).toBe(
      "# yaml-language-server: $schema=./packages/variant-config/variants.yaml.schema.json",
    );
  });

  it("leaves an empty file, a file of comments, and invalid YAML alone", () => {
    expect(addSchemaHeader("", "variants.yaml")).toBeUndefined();
    expect(addSchemaHeader("# nothing yet\n", "variants.yaml")).toBeUndefined();
    expect(addSchemaHeader("variant: [\n", "variants.yaml")).toBeUndefined();
    expect(addSchemaHeader("- a\n- b\n", "variants.yaml")).toBeUndefined();
  });

  it("reports a notice that is told apart from the notices of renamed settings", () => {
    const notice = schemaHeaderNotice("variant: {}\n", "variants.yaml", "/p/variants.yaml");

    expect(notice).toContain("/p/variants.yaml");
    expect(isSchemaHeaderNotice(notice ?? "")).toBe(true);
    expect(isSchemaHeaderNotice("/p/variants.yaml: variant.instances is now variant.watches")).toBe(false);
    expect(schemaHeaderNotice(`${MAIN}\n\nvariant: {}\n`, "variants.yaml", "/p/variants.yaml")).toBeUndefined();
  });
});

describe("variants.local.yaml written by the tool", () => {
  it("starts a new file with the local schema header", () => {
    const directory = temp();

    writeRuntime(directory, { slug: "demo" });

    const text = readFileSync(join(directory, "variants.local.yaml"), "utf8");
    expect(text.startsWith(`${LOCAL}\n\nruntime:`)).toBe(true);
  });

  it("keeps the schema line of an existing file when it writes again", () => {
    const directory = temp();
    const own = "# yaml-language-server: $schema=./mine.json";
    writeFileSync(join(directory, "variants.local.yaml"), `${own}\n\nruntime:\n  slug: old\n`);

    writeRuntime(directory, { slug: "demo" });

    const text = readFileSync(join(directory, "variants.local.yaml"), "utf8");
    expect(text.startsWith(`${own}\n\nruntime:`)).toBe(true);
    expect(text).not.toContain("raw/refs/heads/main");
  });

  it("adds the header when it writes a file that had none", () => {
    const directory = temp();
    writeFileSync(join(directory, "variants.local.yaml"), "runtime:\n  slug: old\n");

    writeRuntime(directory, { slug: "demo" });

    expect(readFileSync(join(directory, "variants.local.yaml"), "utf8").startsWith(`${LOCAL}\n\n`)).toBe(true);
  });

  it("keeps the header when clearRuntime leaves other keys, and removes the file when none are left", () => {
    const directory = temp();
    const path = join(directory, "variants.local.yaml");
    writeFileSync(path, `${LOCAL}\n\nruntime:\n  slug: demo\nother: 1\n`);

    clearRuntime(directory);
    expect(readFileSync(path, "utf8").startsWith(`${LOCAL}\n\nother: 1`)).toBe(true);

    writeFileSync(path, `${LOCAL}\n\nruntime:\n  slug: demo\n`);
    clearRuntime(directory);
    expect(() => readFileSync(path, "utf8")).toThrow();
  });
});
