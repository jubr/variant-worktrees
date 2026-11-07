/**
 * Specification: openspec/specs/meta/release-artifacts/spec.md
 * Specification: openspec/specs/meta/ci-feature-builds/spec.md
 */
import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";

type Step = {
  id?: string;
  uses?: string;
  run?: string;
  with?: Record<string, unknown>;
  env?: Record<string, string>;
};

type Job = {
  needs?: string | string[];
  if?: string;
  uses?: string;
  with?: Record<string, unknown>;
  permissions?: Record<string, string>;
  steps?: Step[];
};

type Workflow = {
  on?: {
    workflow_call?: { inputs?: Record<string, { required?: boolean }> };
    workflow_dispatch?: { inputs?: Record<string, { required?: boolean }> };
  };
  permissions?: Record<string, string>;
  jobs?: Record<string, Job>;
};

const root = join(import.meta.dir, "..");
const workflows = join(root, ".github", "workflows");
const commitPin = /^[0-9a-f]{40}$/;
const executableSuffixes = [
  "linux-x64",
  "linux-arm64",
  "darwin-x64",
  "darwin-arm64",
  "windows-x64.exe",
  "windows-arm64.exe",
];

const workflow = (name: string): Workflow => parse(readFileSync(join(workflows, name), "utf8")) as Workflow;

const needsOf = (job: Job): string[] => (Array.isArray(job.needs) ? job.needs : job.needs ? [job.needs] : []);

const pinOf = (uses: string | undefined, action: string): string => {
  const ref = uses?.split(/\s+#/)[0]?.trim().slice(action.length + 1);
  return ref ?? "";
};

describe("packslip workflow", () => {
  test("signs the six executables in a read-only job and uploads only the bundle", () => {
    const file = workflow("packslip.yaml");
    const jobs = file.jobs ?? {};

    expect(file.permissions).toBeUndefined();
    expect(file.on?.workflow_call?.inputs?.tag.required).toBe(true);
    expect(file.on?.workflow_dispatch?.inputs?.tag.required).toBe(true);

    const signing = Object.values(jobs).find((job) => job.steps?.some((step) => step.uses?.startsWith("jdx/packslip@")));
    const uploading = Object.values(jobs).find((job) => job.steps?.some((step) => step.run?.includes("gh release upload")));
    expect(signing).toBeDefined();
    expect(uploading).toBeDefined();

    for (const job of [signing, uploading]) {
      expect(job?.if).toContain("github.ref == 'refs/heads/main'");
    }

    expect(signing?.permissions).toEqual({
      contents: "read",
      "id-token": "write",
      attestations: "write",
    });
    const action = signing?.steps?.find((step) => step.uses?.startsWith("jdx/packslip@"));
    expect(commitPin.test(pinOf(action?.uses, "jdx/packslip"))).toBe(true);
    expect(action?.with?.bin).toBe("variant");
    expect(action?.with?.upload).toBe(false);
    expect(action?.with?.token).toBeUndefined();
    expect(action?.with?.download).toBeUndefined();

    const download = signing?.steps?.map((step) => step.run ?? "").join("\n") ?? "";
    for (const suffix of executableSuffixes) {
      expect(download).toContain(`variant-\${version}-${suffix}`);
    }
    expect(download).not.toContain("variant-*");

    for (const actionName of ["actions/upload-artifact", "actions/download-artifact"] as const) {
      const step = [...(signing?.steps ?? []), ...(uploading?.steps ?? [])].find((item) =>
        item.uses?.startsWith(`${actionName}@`),
      );
      expect(commitPin.test(pinOf(step?.uses, actionName))).toBe(true);
    }

    expect(uploading?.permissions).toEqual({ contents: "write" });
    const upload = uploading?.steps?.find((step) => step.run?.includes("gh release upload"));
    const uploadText = `${JSON.stringify(upload?.env ?? {})}\n${upload?.run ?? ""}`;
    expect(uploadText).toContain("inputs.tag");
    expect(uploadText).toContain("packslip.sigstore.json");
    expect(uploadText).toContain("--clobber");
  });
});

describe("release workflow", () => {
  test("calls packslip after the release and leaves SHA256SUMS on the built assets", () => {
    const file = workflow("ci-release.yaml");
    const jobs = file.jobs ?? {};
    const build = jobs.build;
    const release = jobs.release;
    const caller = Object.values(jobs).find((job) => job.uses === "./.github/workflows/packslip.yaml");

    expect(build?.steps?.some((step) => step.run?.includes("SHA256SUMS"))).toBe(true);
    expect(JSON.stringify(build)).not.toContain("packslip.sigstore.json");
    expect(needsOf(release as Job)).toContain("build");
    expect(caller).toBeDefined();
    expect(needsOf(caller as Job)).toEqual(expect.arrayContaining(["release"]));
    expect(caller?.with?.tag).toBe("v${{ needs.version.outputs.version }}");
    expect(caller?.permissions).toEqual({
      contents: "write",
      "id-token": "write",
      attestations: "write",
    });
    expect(caller?.if).toContain("needs.release.result == 'success'");
    expect(caller?.if).toContain("github.ref == 'refs/heads/main'");
    expect(caller?.if).toContain("needs.version.outputs.exists == 'false'");
    expect(caller?.if).toContain("inputs.dry-run");
  });
});

describe("other workflows", () => {
  test("keep upload-artifact on v7 and download-artifact on v8, and do not call packslip", () => {
    const files = readdirSync(workflows).filter((name) => name.endsWith(".yml") || name.endsWith(".yaml"));
    for (const name of files) {
      if (name === "packslip.yaml") {
        continue;
      }
      const text = readFileSync(join(workflows, name), "utf8");
      for (const match of text.matchAll(/actions\/upload-artifact@(\S+)/g)) {
        expect(match[1]).toBe("v7");
      }
      for (const match of text.matchAll(/actions\/download-artifact@(\S+)/g)) {
        expect(match[1]).toBe("v8");
      }
      if (name !== "ci-release.yaml") {
        expect(text).not.toContain("packslip.yaml");
      }
    }
  });
});
