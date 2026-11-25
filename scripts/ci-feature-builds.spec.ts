/**
 * Specification: openspec/specs/meta/ci-feature-builds/spec.md
 * (Extension packages on feature branches)
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";

type Step = { run?: string; env?: Record<string, string>; with?: { name?: string; path?: string } };
type Job = { "runs-on"?: string; "timeout-minutes"?: number; steps?: Step[] };
type Workflow = { jobs: Record<string, Job> };

const workflow = (name: string): Workflow =>
  parse(readFileSync(join(import.meta.dir, "..", ".github", "workflows", name), "utf8")) as Workflow;

const runs = (jobs: Record<string, Job>): string[] =>
  Object.values(jobs).flatMap((job) => (job.steps ?? []).flatMap((step) => (step.run === undefined ? [] : [step.run])));

describe("feature-branch CI", () => {
  test("packages both extensions and attaches no variant executable", () => {
    const branch = workflow("ci-branch.yaml");
    expect(branch.jobs.gate).toBeDefined();
    expect(branch.jobs["node-smoke"]).toBeDefined();
    expect(branch.jobs["cli-prerelease"]).toBeUndefined();
    expect(Object.values(branch.jobs).map((job) => job["runs-on"])).not.toContain("macos-15");
    expect(Object.values(branch.jobs).some((job) => String(job["runs-on"]).includes("macos"))).toBe(false);

    const artifacts = Object.values(branch.jobs).flatMap((job) =>
      (job.steps ?? []).flatMap((step) => (step.with?.name === undefined ? [] : [step.with.name])),
    );
    expect(artifacts).toEqual(["vsix"]);
    // AIDEV-NOTE: the workflow lint is an hk step reached through check:full; packaging is its own late step
    const gate = runs({ gate: branch.jobs.gate });
    expect(gate).toContain("task check:full");
    expect(gate).not.toContain("task lint:workflows");
    expect(gate.indexOf("task package:vsix")).toBeGreaterThan(gate.indexOf("task check:full"));

    const release = workflow("ci-release.yaml");
    expect(runs(release.jobs)).toContain("task package:cli TARGET=${{ matrix.target }}");
  });

  // Specification: openspec/specs/meta/ci-feature-builds/spec.md (Slim runtime available for the pinned Bun)
  test("compiles variant for linux-x64 in the Library and CLI job and smokes --version for the slim runtime, to fail early", () => {
    const steps = workflow("ci-branch.yaml").jobs["node-smoke"]?.steps ?? [];
    const compile = steps.findIndex((step) => step.run === "task package:cli TARGET=bun-linux-x64");
    const smoke = steps.findIndex((step) => step.run?.startsWith("bun scripts/smoke-slim.ts"));

    expect(compile).toBeGreaterThan(steps.findIndex((step) => step.run === "task install:ci"));
    expect(steps[compile]?.env?.GH_TOKEN).toBe("${{ github.token }}");
    expect(smoke).toBeGreaterThan(compile);
    expect(steps[smoke]?.run).toBe("bun scripts/smoke-slim.ts out/variant-*-linux-x64");
    expect(runs({ gate: workflow("ci-branch.yaml").jobs.gate as Job }).join("\n")).not.toContain("package:cli");
    expect(JSON.stringify(workflow("ci-branch.yaml"))).not.toContain("upload-artifact\",\"with\":{\"name\":\"variant");
  });

  // Specification: openspec/specs/meta/ci-feature-builds/spec.md (A hung gate fails)
  test("limits every job to a time well above a normal run, so a hung test run fails the check", () => {
    const limits = Object.entries(workflow("ci-branch.yaml").jobs).map(([name, job]) => [name, job["timeout-minutes"]]);

    for (const [name, limit] of limits) {
      expect(typeof limit, `${name} has no timeout-minutes`).toBe("number");
      expect(limit).toBeGreaterThanOrEqual(10);
      expect(limit).toBeLessThanOrEqual(30);
    }
  });
});
