/**
 * Specification: openspec/specs/meta/local-checks/spec.md
 */
import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dir, "..");

type PlanStep = { name: string; status: string };

const packages = readdirSync(join(root, "packages"), { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && existsSync(join(root, "packages", entry.name, "package.json")))
  .map((entry) => entry.name)
  .sort();

const hkAvailable = Bun.spawnSync(["hk", "--version"], { stdout: "ignore", stderr: "ignore" }).exitCode === 0;

// AIDEV-NOTE: --plan only inspects; no step runs. The JSON plan is on stdout, hk's progress lines on stderr.
const plan = (...args: string[]): string[] => {
  const result = Bun.spawnSync(["hk", ...args, "--plan", "--json"], { cwd: root, stdout: "pipe", stderr: "pipe" });
  if (result.exitCode !== 0) {
    throw new Error(`hk ${args.join(" ")} --plan failed: ${result.stderr.toString()}`);
  }
  const steps = (JSON.parse(result.stdout.toString()) as { steps: PlanStep[] }).steps;
  return steps.filter((step) => step.status === "included").map((step) => step.name);
};

const bare = (names: string[], step: string): string[] => names.filter((name) => name === step);
const ofPackage = (names: string[], step: string): string[] =>
  names.filter((name) => name.startsWith("packages/") && name.endsWith(`:${step}`));

describe.skipIf(!hkAvailable)("local checks through hk", () => {
  test("every package has an hk.pkl", () => {
    const missing = packages.filter((name) => !existsSync(join(root, "packages", name, "hk.pkl")));
    expect(missing.map((name) => `packages/${name}`)).toEqual([]);
  });

  test("the default check plan has one Biome step per package and no heavy step", () => {
    const names = plan("check", "--all");
    expect(ofPackage(names, "biome").sort()).toEqual(packages.map((name) => `packages/${name}:biome`));
    expect(bare(names, "biome")).toEqual([]);
    for (const heavy of ["build", "commitlint", "test:scripts", "docs:build"]) {
      expect(bare(names, heavy)).toEqual([]);
    }
    expect(ofPackage(names, "test")).toEqual([]);
  });

  test("the ci plan adds a test step per package, the build, the script tests and commitlint", () => {
    const names = plan("check", "--all", "--profile", "ci");
    expect(ofPackage(names, "test").sort()).toEqual(packages.map((name) => `packages/${name}:test`));
    for (const heavy of ["build", "commitlint", "test:scripts"]) {
      expect(bare(names, heavy)).toEqual([heavy]);
    }
    expect(bare(names, "docs:build")).toEqual([]);
  });

  test("the full profile adds the docs build", () => {
    const names = plan("check", "--all", "--profile", "ci", "--profile", "full");
    expect(bare(names, "docs:build")).toEqual(["docs:build"]);
  });

  test("the workflow lint runs in the ci profile and the extension packaging in the full profile", () => {
    expect(bare(plan("check", "--all"), "lint:workflows")).toEqual([]);
    expect(bare(plan("check", "--all"), "package:vsix")).toEqual([]);
    const ci = plan("check", "--all", "--profile", "ci");
    expect(bare(ci, "lint:workflows")).toEqual(["lint:workflows"]);
    expect(bare(ci, "package:vsix")).toEqual([]);
    expect(bare(plan("check", "--all", "--profile", "ci", "--profile", "full"), "package:vsix")).toEqual(["package:vsix"]);
  });

  test("pre-commit runs only Biome steps", () => {
    const names = plan("run", "pre-commit", "--all");
    expect(names.length).toBeGreaterThan(0);
    expect(names.filter((name) => !name.endsWith(":biome"))).toEqual([]);
  });

  test("a changed file selects only the Biome step of its package", () => {
    expect(plan("run", "pre-commit", "packages/variant-api/src/index.ts")).toEqual(["packages/variant-api:biome"]);
  });
});
