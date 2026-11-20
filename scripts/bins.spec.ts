/**
 * Specification: openspec/specs/variant-cli/mcp-command/spec.md
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const bins = (name: string): Record<string, string> => {
  const manifest = JSON.parse(readFileSync(join(import.meta.dir, "..", "packages", name, "package.json"), "utf8")) as {
    bin?: string | Record<string, string>;
  };
  return typeof manifest.bin === "string" ? { [name]: manifest.bin } : (manifest.bin ?? {});
};

describe("executables of the packages", () => {
  test("variant is the only bin among variant-api, variant-cli, variant-server and variant-mcp", () => {
    const declared = ["variant-api", "variant-cli", "variant-server", "variant-mcp"].flatMap((name) =>
      Object.keys(bins(name)),
    );

    expect(declared).toEqual(["variant"]);
  });
});
