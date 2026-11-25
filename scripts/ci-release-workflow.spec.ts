/**
 * Specification: openspec/specs/meta/release-artifacts/spec.md (Release executables use the published slim runtime)
 */
import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import { miseBunVersion } from "./bun-slim.ts";

type Step = {
  id?: string;
  name?: string;
  if?: string;
  uses?: string;
  run?: string;
  with?: Record<string, unknown>;
  env?: Record<string, string>;
  "continue-on-error"?: boolean;
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
  jobs?: Record<string, Job>;
};

const release = (): Release =>
  parse(readFileSync(join(import.meta.dir, "..", ".github", "workflows", "ci-release.yaml"), "utf8")) as Release;
const executables = (): Job | undefined => release().jobs?.executables;
const steps = (): Step[] => executables()?.steps ?? [];
const needsOf = (job: Job | undefined): string[] =>
  Array.isArray(job?.needs) ? job.needs : job?.needs ? [job.needs] : [];

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

describe("release workflow slim runtime", () => {
  const workflowsDirectory = join(import.meta.dir, "..", ".github", "workflows");

  test("fetches the slim runtime of the platform from jubr/bun-slim, after mise and the install and before the compile", () => {
    const all = steps();
    const fetch = all.findIndex((step) => step.run?.startsWith("bun scripts/fetch-bun-slim.ts"));
    const compile = all.findIndex((step) => step.run?.startsWith("task package:cli"));

    expect(all[fetch]?.run).toBe("bun scripts/fetch-bun-slim.ts ${{ matrix.slim }}");
    expect(all[fetch]?.if).toBe("matrix.slim != ''");
    expect(all[fetch]?.env?.GH_TOKEN).toBe("${{ github.token }}");
    expect(fetch).toBeGreaterThan(all.findIndex((step) => step.uses?.startsWith("jdx/mise-action")));
    expect(fetch).toBeGreaterThan(all.findIndex((step) => step.run === "task install:ci"));
    expect(fetch).toBeLessThan(compile);
  });

  test("compiles with the Bun that mise.toml pins exactly, the version the slim runtime is picked by", () => {
    expect(miseBunVersion(readFileSync(join(import.meta.dir, "..", "mise.toml"), "utf8"))).toMatch(/^\d+\.\d+\.\d+$/);
    expect(steps().some((step) => step.uses?.startsWith("jdx/mise-action"))).toBe(true);
    expect(steps().some((step) => step.uses?.startsWith("oven-sh/setup-bun"))).toBe(false);
  });

  test("does not fail the job when the fetch fails: the script warns and leaves the variable unset", () => {
    const script = readFileSync(join(import.meta.dir, "fetch-bun-slim.ts"), "utf8");

    expect(script).toContain("::warning::");
    expect(script).toContain("GITHUB_ENV");
    expect(steps().find((step) => step.run?.startsWith("bun scripts/fetch-bun-slim.ts"))?.["continue-on-error"]).toBeUndefined();
  });

  test("gives a slim runtime to Linux and macOS platforms and none to Windows", () => {
    const include = executables()?.strategy?.matrix?.include ?? [];

    expect(include.filter((entry) => entry.target.startsWith("bun-windows")).map((entry) => entry.slim)).toEqual(["", ""]);
    for (const entry of include.filter((candidate) => candidate.slim !== "")) {
      expect(entry.target).toBe(`bun-${entry.slim}`);
    }
  });

  test("does not build Bun itself or cache a runtime", () => {
    expect(readdirSync(workflowsDirectory)).not.toContain("bun-standalone.yaml");
    expect(JSON.stringify(release())).not.toContain("actions/cache");
    expect(JSON.stringify(release())).not.toContain("bun-standalone");
  });
});
