/**
 * Specification: openspec/specs/meta/bun-standalone-build/spec.md
 */
import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
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
  /scripts\/build\.ts|brew install|apt-get|rustup|bun install|sed /.test(step.run ?? "") ||
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

const patchFiles = [
  "scripts/build/flags.ts",
  "scripts/build/rust.ts",
  "src/runtime/lib.rs",
  "src/runtime/api/BunObject.rs",
  "src/runtime/webcore/Body.rs",
  "src/runtime/image/Image.classes.ts",
  "src/runtime/ffi/ffi.classes.ts",
  "src/runtime/ffi/mod.rs",
];
const stubFiles = ["src/runtime/image_standalone_stub.rs", "src/runtime/ffi/ffi_standalone_stub.rs"];
const patchStep = (): Step | undefined => buildSteps().find((step) => step.id === "patch");

// Specification: openspec/specs/meta/bun-standalone-build/spec.md (Smaller runtime through source patches)
describe("bun-standalone workflow patches", () => {
  test("patches the checked-out source between the checkout and the compile, only when compiling", () => {
    const steps = buildSteps();
    const ids = steps.map((step) => step.id ?? step.name);
    const compile = steps.findIndex((step) => step.run?.includes("scripts/build.ts"));

    expect(patchStep()?.if).toContain(guard);
    expect(ids.indexOf("patch")).toBeGreaterThan(ids.indexOf("Check out the pull request head"));
    expect(ids.indexOf("patch")).toBeLessThan(compile);
  });

  test("patches with sed, shows a diff -u per file and fails when a patch changes nothing", () => {
    const run = patchStep()?.run ?? "";

    expect(run).toContain("sed");
    expect(run).toContain("diff -u");
    expect(run).toContain("did not change");
    expect(run).not.toMatch(/git apply|\bpatch -p|git cherry-pick/);
    for (const file of [...patchFiles, ...stubFiles]) {
      expect(run, file).toContain(file);
    }
  });

  test("compiles the standalone runtime size-optimized", () => {
    const compile = buildSteps().find((step) => step.run?.includes("scripts/build.ts"));

    expect(compile?.run).toContain("--standalone=on");
    expect(compile?.run).toContain("--build-type=MinSizeRel");
    expect(compile?.run).toContain("--build-dir=build/release-standalone");
  });

  test("checks that Bun.Image and bun:ffi are gone from the runtime, hit or fresh", () => {
    const smoke = buildSteps().find((step) => step.id === "smoke");

    expect(smoke?.run).toContain("Bun.Image");
    expect(smoke?.run).toContain("dlopen");
  });
});

const fixtures: Record<string, string> = {
  "scripts/build/flags.ts": `  {
    flag: "-Os",
    when: c => c.unix && c.smol,
    desc: "Optimize for size (MinSizeRel)",
  },
`,
  "scripts/build/rust.ts": `    env.CARGO_PROFILE_RELEASE_LTO = "off";
  }
  if (rustflags.length > 0) env.CARGO_ENCODED_RUSTFLAGS = rustflags.join("\x1f");
`,
  "src/runtime/lib.rs": `pub mod dns_jsc;
pub mod image;
#[cfg(not(bun_standalone))]
pub mod test_runner;
`,
  "src/runtime/api/BunObject.rs": `pub(crate) fn get_image_constructor(global_this: &JSGlobalObject, _: &JSObject) -> JSValue {
    jsc::codegen::js::get_constructor::<crate::image::Image>(global_this)
}
`,
  "src/runtime/webcore/Body.rs": `            if let Some(image) = value.as_class_ref::<crate::image::Image>() {
                let x = 1;
            }
`,
  "src/runtime/image/Image.classes.ts": `  define({
    name: "Image",
    construct: true,
`,
  "src/runtime/ffi/ffi.classes.ts": `  define({
    name: "FFI",
    construct: true,
`,
  "src/runtime/ffi/mod.rs": `use core::ffi::{c_char, c_void};
use core::ptr::NonNull;

use bun_core::ZBox;

use crate::jsc::JSGlobalObject;

mod host_fns;
pub use host_fns::{generate_symbol_for_function, generate_symbols};

#[path = "ffi_body.rs"]
mod ffi_body;

mod dom_call_slowpath {
    use crate::jsc::{JSGlobalObject, JSValue};
}

use bun_tcc_sys as TCC;

pub(crate) fn get_dl_error() -> Box<[u8]> {
    unsafe {
        let msg = 1;
    }
}

pub struct Function {
    pub x: u8,
}

impl Default for Function {
    fn default() -> Self {}
}

pub static LIB_DIR_Z: bun_core::RacyCell<*const c_char> = bun_core::RacyCell::new(c"".as_ptr());

unsafe extern "C" {
    fn FFICallbackFunctionWrapper_destroy(_: *mut c_void);
}

impl Drop for Function {
    fn drop(&mut self) {}
}

impl Function {
    pub fn needs_handle_scope(&self) -> bool {}
}

pub enum Step {
    Pending,
}

pub struct Compiled {
    pub ptr: *mut c_void,
}

impl Default for Compiled {
    fn default() -> Self {}
}

impl Step {
    pub fn compiled_ptr(&self) {}
}

mod abi_type;
pub use abi_type::{ABI_TYPE_LABEL, ABIType};
`,
};

// A typo in a sed expression is the likely failure, and it only shows after a long compile, so run the step on fixtures.
describe("bun-standalone workflow patch step on the upstream lines", () => {
  const gnuSed = spawnSync("sed", ["--version"]).status === 0 || spawnSync("gsed", ["--version"]).status === 0;
  const maybe = gnuSed ? test : test.skip;

  maybe("rewrites each file as intended and adds the two stubs", () => {
    const root = mkdtempSync(join(tmpdir(), "bun-patch-"));
    for (const [file, text] of Object.entries(fixtures)) {
      mkdirSync(dirname(join(root, file)), { recursive: true });
      writeFileSync(join(root, file), text);
    }
    const script = patchStep()?.run ?? "";
    const result = spawnSync("bash", ["-e", "-c", script], { cwd: root, encoding: "utf8" });
    const read = (file: string): string => readFileSync(join(root, file), "utf8");

    expect(result.stderr).not.toContain("did not change");
    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    expect(read("scripts/build/flags.ts")).toContain('flag: "-Oz",');
    expect(read("scripts/build/rust.ts")).toMatch(
      /if \(cfg\.smol\) env\.CARGO_PROFILE_RELEASE_OPT_LEVEL = "z";\n {2}if \(rustflags/,
    );
    expect(read("src/runtime/lib.rs")).toContain(
      '#[cfg(not(bun_standalone))]\npub mod image;\n#[cfg(bun_standalone)]\n#[path = "image_standalone_stub.rs"]\npub mod image;',
    );
    expect(read("src/runtime/api/BunObject.rs")).toMatch(
      /#\[cfg\(bun_standalone\)\]\npub\(crate\) fn get_image_constructor\(_: &JSGlobalObject, _: &JSObject\) -> JSValue \{\n {4}JSValue::UNDEFINED\n\}\n\n#\[cfg\(not\(bun_standalone\)\)\]\npub\(crate\) fn get_image_constructor\(global_this/,
    );
    expect(read("src/runtime/webcore/Body.rs")).toMatch(
      / {12}#\[cfg\(not\(bun_standalone\)\)\]\n {12}if let Some\(image\)/,
    );
    expect(read("src/runtime/image/Image.classes.ts")).toContain('name: "Image",\n    standaloneStub: "');
    expect(read("src/runtime/ffi/ffi.classes.ts")).toContain('name: "FFI",\n    standaloneStub: "');
    const mod = read("src/runtime/ffi/mod.rs");
    for (const item of [
      "mod host_fns;",
      "pub use host_fns::",
      '#[path = "ffi_body.rs"]',
      "use bun_tcc_sys as TCC;",
      "pub(crate) fn get_dl_error",
      "pub struct Function",
      "impl Default for Function",
      "pub static LIB_DIR_Z",
      'unsafe extern "C" {',
      "impl Drop for Function",
      "impl Function {",
      "pub enum Step",
      "pub struct Compiled",
      "impl Default for Compiled",
      "impl Step",
      "mod abi_type;",
      "pub use abi_type::",
    ]) {
      expect(mod, item).toContain(`#[cfg(not(bun_standalone))]\n${item}`);
    }
    expect(mod).toContain(
      '#[path = "ffi_body.rs"]\nmod ffi_body;\n#[cfg(bun_standalone)]\n#[path = "ffi_standalone_stub.rs"]\nmod ffi_body;',
    );
    for (const item of [
      "use core::ffi::{c_char, c_void};",
      "use core::ptr::NonNull;",
      "use bun_core::ZBox;",
      "use crate::jsc::JSGlobalObject;",
    ]) {
      expect(mod, item).toContain(`#[cfg_attr(bun_standalone, allow(unused_imports))]\n${item}`);
    }
    expect(read("src/runtime/image_standalone_stub.rs")).toContain("pub struct AsyncImageTask");
    expect(read("src/runtime/ffi/ffi_standalone_stub.rs")).toContain("pub fn bun__ffi__cc");
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
