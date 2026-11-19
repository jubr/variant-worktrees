/**
 * Specification: openspec/specs/meta/local-checks/spec.md
 * (Slow package tests run as their own step)
 */
import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

const root = join(import.meta.dir, "..");

const scriptsOf = (name: string): Record<string, string> =>
  (JSON.parse(readFileSync(join(root, "packages", name, "package.json"), "utf8")) as { scripts?: Record<string, string> })
    .scripts ?? {};

const packages = readdirSync(join(root, "packages")).filter((name) => "test:slow" in scriptsOf(name));

const specFiles = (directory: string): string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? entry.name === "node_modules" || entry.name === "dist"
        ? []
        : specFiles(join(directory, entry.name))
      : /\.spec\.tsx?$/.test(entry.name)
        ? [join(directory, entry.name)]
        : [],
  );

/** The `src/...spec.ts` paths a script names, after `--path-ignore-patterns` for the fast script. */
const named = (script: string): string[] => script.split(/\s+/).filter((word) => /^'?src\/.*\.spec\.tsx?'?$/.test(word)).map((word) => word.replaceAll("'", ""));

describe("split package tests", () => {
  test("a package with a test:slow script exists", () => {
    expect(packages.length).toBeGreaterThan(0);
  });

  for (const name of packages) {
    describe(name, () => {
      const slow = named(scriptsOf(name)["test:slow"] ?? "");
      const ignored = named(scriptsOf(name).test ?? "");

      test("every file of test:slow exists", () => {
        expect(slow.filter((file) => !existsSync(join(root, "packages", name, file)))).toEqual([]);
        expect(slow.length).toBeGreaterThan(0);
      });

      test("test ignores exactly the files test:slow runs", () => {
        expect(ignored.sort()).toEqual([...slow].sort());
      });

      test("each test file runs in exactly one of the two scripts", () => {
        const all = specFiles(join(root, "packages", name, "src")).map((file) =>
          relative(join(root, "packages", name), file),
        );
        const fast = all.filter((file) => !ignored.includes(file));
        expect(fast.filter((file) => slow.includes(file))).toEqual([]);
        expect(all.filter((file) => !fast.includes(file) && !slow.includes(file))).toEqual([]);
        expect(fast.length + slow.length).toBe(all.length);
      });
    });
  }
});
