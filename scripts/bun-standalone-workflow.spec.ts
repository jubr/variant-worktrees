/**
 * Specification: openspec/specs/meta/bun-standalone-build/spec.md
 */
import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";

type Step = {
  id?: string;
  name?: string;
  if?: string;
  uses?: string;
  run?: string;
  with?: Record<string, unknown>;
};

type Job = {
  "timeout-minutes"?: number;
  needs?: string | string[];
  outputs?: Record<string, string>;
  strategy?: { matrix?: { include?: { target: string; runner: string }[] } };
  steps?: Step[];
};

type Workflow = {
  concurrency?: { group?: string };
  on?: {
    schedule?: { cron: string }[];
    workflow_dispatch?: unknown;
    workflow_call?: { outputs?: Record<string, { value: string }> };
    pull_request?: unknown;
    push?: { paths?: string[]; branches?: string[]; "branches-ignore"?: string[] };
  };
  permissions?: Record<string, string>;
  jobs?: Record<string, Job>;
};

const workflows = join(import.meta.dir, "..", ".github", "workflows");
const name = "bun-standalone.yaml";
const load = (): Workflow => parse(readFileSync(join(workflows, name), "utf8")) as Workflow;

describe("bun-standalone workflow triggers", () => {
  test("runs on a schedule, by dispatch, and on a push that changes only its own file", () => {
    const { on } = load();

    expect(on?.schedule?.length).toBeGreaterThan(0);
    expect(on?.workflow_dispatch).toBeDefined();
    expect(on?.push?.paths).toEqual([`.github/workflows/${name}`]);
  });

  test("does not run for pull requests of this repository", () => {
    expect(load().on?.pull_request).toBeUndefined();
  });

  test("can be called, and gives the caller the head sha and the workflow hash", () => {
    const outputs = load().on?.workflow_call?.outputs;

    expect(outputs?.sha?.value).toContain("jobs.resolve.outputs.sha");
    expect(outputs?.workflow?.value).toContain("jobs.resolve.outputs.workflow");
  });

  test("queues per calling workflow, so a call from the release does not replace its own run", () => {
    expect(load().concurrency?.group).toContain("github.workflow");
  });

  test("limits every job, so a hung compile fails instead of waiting for hours", () => {
    for (const [jobName, job] of Object.entries(load().jobs ?? {})) {
      expect(typeof job["timeout-minutes"], `${jobName} has no timeout-minutes`).toBe("number");
    }
  });

  test("reads the repository and writes nothing", () => {
    expect(load().permissions).toEqual({ contents: "read" });
  });

  test("is used by no workflow other than the CI workflow", () => {
    for (const other of readdirSync(workflows)) {
      if (other !== name && other !== "ci-branch.yaml") {
        expect(readFileSync(join(workflows, other), "utf8"), other).not.toContain(name);
      }
    }
  });
});

const guard = "steps.binary.outputs.cache-hit != 'true'";
const buildSteps = (): Step[] => load().jobs?.build?.steps ?? [];
const stepText = (step: Step): string => `${step.uses ?? ""}\n${step.run ?? ""}`;
const isBuildWork = (step: Step): boolean =>
  /build:standalone|brew install|apt-get|rustup|bun install/.test(step.run ?? "") ||
  /^(actions\/checkout|oven-sh\/setup-bun)@/.test(step.uses ?? "") ||
  step.id === "dependencies";

describe("bun-standalone workflow caches", () => {
  test("builds after resolving, and keys each platform's binary on the head sha and a hash of this file taken where the repository is checked out", () => {
    const build = load().jobs?.build;
    const binary = buildSteps().find((step) => step.id === "binary");
    const key = String(binary?.with?.key);

    expect(build?.needs).toBe("resolve");
    expect(binary?.uses).toMatch(/^actions\/cache@v\d+$/);
    expect(key).toContain("matrix.target");
    expect(key).toContain("needs.resolve.outputs.sha");
    expect(key).toContain("needs.resolve.outputs.workflow");
    const resolve = load().jobs?.resolve;
    const hash = resolve?.steps?.find((step) => step.id === "workflow");
    expect(hash?.run).toContain("hashFiles('.github/workflows/bun-standalone.yaml')");
    expect(resolve?.outputs?.workflow).toContain("steps.workflow.outputs.hash");
    expect(binary?.with?.["restore-keys"]).toBeUndefined();
  });

  test("restores dependencies and compiler output by prefix without letting them stand in for the binary", () => {
    const dependencies = buildSteps().find((step) => step.id === "dependencies");
    const restoreKeys = String(dependencies?.with?.["restore-keys"]).trim().split("\n");

    expect(String(dependencies?.with?.path)).toContain("build-cache");
    expect(restoreKeys.length).toBeGreaterThanOrEqual(1);
    for (const prefix of restoreKeys) {
      expect(prefix).toContain("matrix.target");
      expect(prefix).not.toContain("needs.resolve.outputs.sha");
    }
    expect(String(dependencies?.with?.path)).not.toContain("bun-standalone");
  });

  test("installs a toolchain and compiles only when the binary cache missed", () => {
    const work = buildSteps().filter(isBuildWork);

    expect(work.length).toBeGreaterThanOrEqual(5);
    for (const step of work) {
      expect(step.if, stepText(step)).toContain(guard);
    }
  });
});

describe("bun-standalone workflow output", () => {
  test("builds macOS arm64, macOS x64, Linux x64 and Linux arm64", () => {
    const include = load().jobs?.build?.strategy?.matrix?.include;

    expect(include?.map((entry) => entry.target)).toEqual(["darwin-arm64", "darwin-x64", "linux-x64", "linux-arm64"]);
    expect(include?.find((entry) => entry.target === "darwin-x64")?.runner).toBe("macos-15-intel");
  });

  test("checks a hit and a fresh build alike: version, a script, and a refused build", () => {
    const smoke = buildSteps().find((step) => step.id === "smoke");

    expect(smoke?.if).toBeUndefined();
    expect(smoke?.run).toContain("--version");
    expect(smoke?.run).toContain("-e ");
    expect(smoke?.run).toMatch(/build \S+/);
    expect(smoke?.run).toContain("exit 1");
    const ids = buildSteps().map((step) => step.id);
    expect(ids.indexOf("smoke")).toBeGreaterThan(ids.indexOf("dependencies"));
  });

  test("attaches one archive per platform only after the smoke test, and names the head in the summary", () => {
    const steps = buildSteps();
    const upload = steps.find((step) => step.uses?.startsWith("actions/upload-artifact@"));
    const summary = steps.find((step) => step.run?.includes("GITHUB_STEP_SUMMARY"));

    expect(upload?.uses).toBe("actions/upload-artifact@v7");
    expect(String(upload?.with?.path)).toContain("bun-standalone-${{ matrix.target }}.zip");
    expect(upload?.with?.["if-no-files-found"]).toBe("error");
    expect(steps.indexOf(upload as Step)).toBeGreaterThan(steps.findIndex((step) => step.id === "smoke"));
    expect(summary?.run).toContain("needs.resolve.outputs.sha");
  });
});

type CallingJob = {
  name?: string;
  uses?: string;
  if?: string;
  needs?: string | string[];
  with?: Record<string, unknown>;
  permissions?: Record<string, string>;
};

type CiWorkflow = {
  on?: {
    workflow_call?: {
      inputs?: Record<string, { type?: string; default?: string }>;
      outputs?: Record<string, { value: string }>;
    };
  };
  jobs?: Record<string, CallingJob>;
};

const ci = (): CiWorkflow => parse(readFileSync(join(workflows, "ci-branch.yaml"), "utf8")) as CiWorkflow;

// Specification: openspec/specs/meta/bun-standalone-build/spec.md (Run by CI on main only)
describe("CI workflow Bun standalone job", () => {
  test("calls the build workflow, read-only, on main or when asked for", () => {
    const job = ci().jobs?.["bun-standalone"];

    expect(job?.name).toBe("Bun standalone");
    expect(job?.uses).toBe("./.github/workflows/bun-standalone.yaml");
    expect(job?.if).toContain("github.ref == 'refs/heads/main'");
    expect(job?.if).toContain("inputs.bun-standalone == 'yes'");
    expect(job?.permissions).toEqual({ contents: "read" });
  });

  test("takes a yes|no input that defaults to no and returns the head sha and workflow hash", () => {
    const call = ci().on?.workflow_call;

    expect(call?.inputs?.["bun-standalone"]).toMatchObject({ type: "string", default: "no" });
    expect(call?.outputs?.["bun-standalone-sha"]?.value).toContain("jobs.bun-standalone.outputs.sha");
    expect(call?.outputs?.["bun-standalone-workflow"]?.value).toContain("jobs.bun-standalone.outputs.workflow");
  });
});
