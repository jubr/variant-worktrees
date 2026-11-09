/**
 * Specification: openspec/specs/meta/colocated-tests/spec.md
 */
import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { colocatedTestViolations } from "./colocated-tests.ts";

const root = join(import.meta.dir, "..");
const skippedDirectories = new Set(["node_modules", "dist", ".cache"]);

const filesUnder = (directory: string): string[] => {
  const files: string[] = [];
  const visit = (current: string): void => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      if (skippedDirectories.has(entry.name)) continue;
      const path = join(current, entry.name);
      if (entry.isDirectory()) visit(path);
      else files.push(relative(root, path));
    }
  };
  visit(directory);
  return files;
};

const packageTestDirectories = (): string[] =>
  readdirSync(join(root, "packages"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => `packages/${entry.name}/test`)
    .filter((directory) => existsSync(join(root, directory)) && statSync(join(root, directory)).isDirectory());

describe("package test directories are absent", () => {
  test("names packages/variant-vscode/test when it contains setup.ts", () => {
    const violations = colocatedTestViolations(
      ["packages/variant-vscode/test/setup.ts"],
      ["packages/variant-vscode/test"],
    );

    expect(violations).toEqual([{ paths: ["packages/variant-vscode/test"] }]);
  });

  test("names packages/variant-config/test when it contains schema.test.ts", () => {
    const violations = colocatedTestViolations(
      ["packages/variant-config/test/schema.test.ts"],
      ["packages/variant-config/test"],
    );

    expect(violations).toContainEqual({ paths: ["packages/variant-config/test"] });
  });

  test("does not fail when no package has a test directory", () => {
    expect(colocatedTestViolations(["packages/variant-api/src/slug.ts"], [])).toEqual([]);
  });

  test("does not fail for scripts/docs-coverage.spec.ts", () => {
    expect(colocatedTestViolations(["scripts/docs-coverage.spec.ts"], [])).toEqual([]);
  });
});

describe("source test directories hold helpers only", () => {
  test("names packages/variant-api/src/test/slug.spec.ts", () => {
    const violations = colocatedTestViolations(["packages/variant-api/src/test/slug.spec.ts"], []);

    expect(violations).toEqual([{ paths: ["packages/variant-api/src/test/slug.spec.ts"] }]);
  });

  test("does not fail for packages/variant-api/src/test/setup.ts", () => {
    expect(colocatedTestViolations(["packages/variant-api/src/test/setup.ts"], [])).toEqual([]);
  });

  test("does not fail for packages/variant-api/src/test/mise-mock.ts", () => {
    expect(colocatedTestViolations(["packages/variant-api/src/test/mise-mock.ts"], [])).toEqual([]);
  });

  test("does not fail for a spec under src/testing", () => {
    expect(colocatedTestViolations(["packages/variant-ui/src/testing/harness.spec.ts"], [])).toEqual([]);
  });

  test("names packages/variant-api/src/operations/test/implode.spec.ts", () => {
    const file = "packages/variant-api/src/operations/test/implode.spec.ts";
    const violations = colocatedTestViolations([file], []);

    expect(violations).toEqual([{ paths: [file] }]);
  });
});

describe("package tests use the spec suffix", () => {
  test("names packages/variant-vscode/src/extension.test.ts", () => {
    const file = "packages/variant-vscode/src/extension.test.ts";
    const violations = colocatedTestViolations([file], []);

    expect(violations).toEqual([{ paths: [file] }]);
  });

  test("does not fail for packages/variant-vscode/src/extension.spec.ts", () => {
    expect(colocatedTestViolations(["packages/variant-vscode/src/extension.spec.ts"], [])).toEqual([]);
  });

  test("names a .test.tsx file under packages", () => {
    const file = "packages/variant-ui/src/panel.test.tsx";

    expect(colocatedTestViolations([file], [])).toEqual([{ paths: [file] }]);
  });
});

describe("a unique source stem keeps its test beside it", () => {
  test("names slug.ts and the spec that sits in another directory", () => {
    const source = "packages/variant-api/src/slug.ts";
    const spec = "packages/variant-api/src/other/slug.spec.ts";
    const violations = colocatedTestViolations([source, spec], []);

    expect(violations).toEqual([{ paths: [source, spec] }]);
  });

  test("does not fail when slug.spec.ts sits beside slug.ts", () => {
    expect(
      colocatedTestViolations(["packages/variant-api/src/slug.ts", "packages/variant-api/src/slug.spec.ts"], []),
    ).toEqual([]);
  });

  test("does not fail for product-icon.spec.ts when no product-icon source exists", () => {
    expect(colocatedTestViolations(["packages/variant-ui/src/product-icon.spec.ts"], [])).toEqual([]);
  });

  test("does not fail index.spec.ts when src/index.ts and src/db/index.ts both exist", () => {
    expect(
      colocatedTestViolations(
        [
          "packages/variant-api/src/index.ts",
          "packages/variant-api/src/db/index.ts",
          "packages/variant-api/src/other/index.spec.ts",
        ],
        [],
      ),
    ).toEqual([]);
  });

  test("names a .d.ts source and the spec that sits in another directory", () => {
    const source = "packages/variant-vscode/src/cursor-mcp.d.ts";
    const spec = "packages/variant-vscode/src/other/cursor-mcp.spec.ts";

    expect(colocatedTestViolations([source, spec], [])).toEqual([{ paths: [source, spec] }]);
  });

  test("names a .tsx source and the .spec.tsx that sits in another directory", () => {
    const source = "packages/variant-ui/src/panel.tsx";
    const spec = "packages/variant-ui/src/other/panel.spec.tsx";

    expect(colocatedTestViolations([source, spec], [])).toEqual([{ paths: [source, spec] }]);
  });
});

describe("the packages tree", () => {
  test("names no file", () => {
    expect(colocatedTestViolations(filesUnder(join(root, "packages")), packageTestDirectories())).toEqual([]);
  });
});
