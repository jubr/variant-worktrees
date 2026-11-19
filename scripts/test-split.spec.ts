/**
 * Specification: openspec/specs/meta/local-checks/spec.md
 * (Slow package tests run as their own step)
 */
import { describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";

const root = join(import.meta.dir, "..");

type PackageJson = { config?: { slow_tests?: string }; scripts?: Record<string, string> };

const packageJson = (name: string): PackageJson =>
  JSON.parse(readFileSync(join(root, "packages", name, "package.json"), "utf8")) as PackageJson;

const packages = readdirSync(join(root, "packages")).filter((name) => "test:slow" in (packageJson(name).scripts ?? {}));

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

/**
 * The arguments a package script passes to `bun test`, as `bun run` expands them (`set -x` traces to stderr): `bun test` is replaced by `echo`
 * in a scratch package that has the same `config.slow_tests`, so the shell of `bun run` does the expansion.
 */
const argumentsOf = (script: string, slowTests: string): string[] => {
  const echoed = script.replace(/bun test/, "echo");
  expect(echoed).not.toBe(script);
  const directory = mkdtempSync(join(tmpdir(), "test-split-"));
  try {
    writeFileSync(
      join(directory, "package.json"),
      JSON.stringify({ name: "scratch", config: { slow_tests: slowTests }, scripts: { args: echoed } }),
    );
    const result = Bun.spawnSync(["bun", "run", "--silent", "args"], { cwd: directory, stdout: "pipe", stderr: "pipe" });
    expect(result.exitCode).toBe(0);
    return result.stdout.toString().trim().split(/\s+/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
};

describe("split package tests", () => {
  test("a package with a test:slow script exists", () => {
    expect(packages.length).toBeGreaterThan(0);
  });

  for (const name of packages) {
    describe(name, () => {
      const slowTests = packageJson(name).config?.slow_tests ?? "";
      const slow = slowTests.split(/\s+/).filter((file) => file !== "");

      test("config.slow_tests names at least one file, and every one exists", () => {
        expect(slow.length).toBeGreaterThan(0);
        expect(slow.filter((file) => !existsSync(join(root, "packages", name, file)))).toEqual([]);
      });

      test("test:slow runs exactly the files of config.slow_tests", () => {
        const args = argumentsOf(packageJson(name).scripts?.["test:slow"] ?? "", slowTests);
        expect(args.filter((arg) => /^src\/.*\.spec\.tsx?$/.test(arg))).toEqual(slow);
      });

      test("test ignores exactly the files of config.slow_tests", () => {
        const args = argumentsOf(packageJson(name).scripts?.test ?? "", slowTests);
        const ignored = args.flatMap((arg, at) => (args[at - 1] === "--path-ignore-patterns" ? [arg] : []));
        expect(ignored).toEqual(slow);
        expect(args.filter((arg) => arg === "--path-ignore-patterns")).toHaveLength(slow.length);
      });

      test("each test file runs in exactly one of the two scripts", () => {
        const all = specFiles(join(root, "packages", name, "src")).map((file) =>
          relative(join(root, "packages", name), file),
        );
        const fast = all.filter((file) => !slow.includes(file));
        expect(fast.length + slow.length).toBe(all.length);
        expect(slow.filter((file) => !all.includes(file))).toEqual([]);
      });
    });
  }
});
