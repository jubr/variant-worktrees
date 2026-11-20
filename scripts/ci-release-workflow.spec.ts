/**
 * Specification: openspec/specs/meta/release-artifacts/spec.md (Release executables use the cached slim runtime)
 * Specification: openspec/specs/meta/bun-standalone-build/spec.md (Run by CI on main only)
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";

type Step = {
  id?: string;
  name?: string;
  if?: string;
  uses?: string;
  run?: string;
  with?: Record<string, unknown>;
  env?: Record<string, string>;
};

type Job = {
  name?: string;
  needs?: string | string[];
  "runs-on"?: string;
  uses?: string;
  with?: Record<string, unknown>;
  strategy?: { matrix?: { include?: { target: string; slim: string }[] } };
  steps?: Step[];
};

type Release = {
  on?: { workflow_dispatch?: { inputs?: Record<string, { type?: string; default?: string }> } };
  jobs?: Record<string, Job>;
};

const release = (): Release =>
  parse(readFileSync(join(import.meta.dir, "..", ".github", "workflows", "ci-release.yaml"), "utf8")) as Release;
const executables = (): Job | undefined => release().jobs?.executables;
const steps = (): Step[] => executables()?.steps ?? [];
const needsOf = (job: Job | undefined): string[] =>
  Array.isArray(job?.needs) ? job.needs : job?.needs ? [job.needs] : [];

describe("release workflow slim runtime switch", () => {
  test("offers a bun-standalone yes|no input, off by default, and hands it to the CI call", () => {
    const input = release().on?.workflow_dispatch?.inputs?.["bun-standalone"];

    expect(input).toMatchObject({ default: "no" });
    expect(String(release().jobs?.ci?.with?.["bun-standalone"])).toContain("inputs.bun-standalone");
  });
});

describe("release workflow executables", () => {
  test("compiles one platform per job, all six, after the CI call and the version check", () => {
    const job = executables();
    const targets = job?.strategy?.matrix?.include?.map((entry) => entry.target);

    expect(targets).toEqual([
      "bun-linux-x64",
      "bun-linux-arm64",
      "bun-darwin-x64",
      "bun-darwin-arm64",
      "bun-windows-x64",
      "bun-windows-arm64",
    ]);
    expect(needsOf(job).sort()).toEqual(["ci", "version"]);
    expect(steps().map((step) => step.run)).toContain("task package:cli TARGET=${{ matrix.target }}");
    expect(steps().map((step) => step.run)).not.toContain("task package:cli:all");
  });

  test("keeps the release assets: both vsix, the executables and the checksums in release-assets", () => {
    const jobs = release().jobs ?? {};
    const gather = jobs.build;
    const text = JSON.stringify(gather?.steps);

    expect(needsOf(gather).sort()).toEqual(["executables", "vsix"]);
    expect(text).toContain("SHA256SUMS");
    expect(text).toContain("release-assets");
    expect(JSON.stringify(jobs.vsix?.steps)).toContain("task package:vsix");
    expect(needsOf(jobs.release)).toContain("build");
  });
});

const standaloneTargets = (): string[] =>
  (
    parse(readFileSync(join(import.meta.dir, "..", ".github", "workflows", "bun-standalone.yaml"), "utf8")) as {
      jobs: { build: { strategy: { matrix: { include: { target: string }[] } } } };
    }
  ).jobs.build.strategy.matrix.include.map((entry) => entry.target);

describe("release workflow slim runtime", () => {
  test("restores the cached binary of the platform under the key the build workflow saves, and does not fail on a miss", () => {
    const restore = steps().find((step) => step.id === "slim");

    expect(restore?.uses).toMatch(/^actions\/cache\/restore@v\d+$/);
    expect(restore?.if).toContain("matrix.slim != ''");
    expect(restore?.with?.path).toBe("build/release-standalone/bun-standalone");
    expect(restore?.with?.key).toBe(
      "bun-standalone-${{ matrix.slim }}-${{ needs.ci.outputs.bun-standalone-sha }}-${{ needs.ci.outputs.bun-standalone-workflow }}",
    );
    expect(restore?.with?.["fail-on-cache-miss"]).not.toBe(true);
  });

  test("sets VARIANT_BUN_RUNTIME only after a hit, before the compile", () => {
    const all = steps();
    const embed = all.findIndex((step) => step.run?.includes("VARIANT_BUN_RUNTIME"));
    const compile = all.findIndex((step) => step.run?.startsWith("task package:cli"));

    expect(embed).toBeGreaterThan(all.findIndex((step) => step.id === "slim"));
    expect(embed).toBeLessThan(compile);
    expect(all[embed]?.if).toContain("steps.slim.outputs.cache-hit == 'true'");
    expect(all[embed]?.if).toContain("matrix.slim != ''");
    expect(all.filter((step) => step.run?.includes("VARIANT_BUN_RUNTIME"))).toHaveLength(1);
  });

  test("gives a slim runtime to Linux and macOS platforms the build workflow compiles, and none to Windows", () => {
    const include = executables()?.strategy?.matrix?.include ?? [];
    const slim = include.filter((entry) => entry.slim !== "");

    expect(include.filter((entry) => entry.target.startsWith("bun-windows")).map((entry) => entry.slim)).toEqual(["", ""]);
    expect(slim.map((entry) => entry.slim).sort()).toEqual(standaloneTargets().sort());
    for (const entry of slim) {
      expect(entry.target).toBe(`bun-${entry.slim}`);
    }
  });
});
