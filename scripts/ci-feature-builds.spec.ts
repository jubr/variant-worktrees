/**
 * Specification: openspec/specs/meta/ci-feature-builds/spec.md
 * (Extension packages on feature branches)
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";

type Step = { run?: string; with?: { name?: string; path?: string } };
type Job = { "runs-on"?: string; steps?: Step[] };
type Workflow = { jobs: Record<string, Job> };

const workflow = (name: string): Workflow =>
  parse(readFileSync(join(import.meta.dir, "..", ".github", "workflows", name), "utf8")) as Workflow;

const runs = (jobs: Record<string, Job>): string[] =>
  Object.values(jobs).flatMap((job) => (job.steps ?? []).flatMap((step) => (step.run === undefined ? [] : [step.run])));

describe("feature-branch CI", () => {
  test("packages both extensions and does not build a variant executable", () => {
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
    expect(runs(branch.jobs).join("\n")).not.toContain("package:cli");

    const release = workflow("ci-release.yaml");
    expect(runs(release.jobs)).toContain("task package:cli:all");
  });
});
