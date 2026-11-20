/**
 * Specification: openspec/specs/meta/release-artifacts/spec.md (Release contents)
 * Specification: openspec/specs/meta/dev-bleeds/spec.md (Optional runtime executable for compiled CLI)
 */
import { describe, expect, test } from "bun:test";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { RELEASE_TARGETS, assetName, compileCli, compileTargets, embeddedAppModule, runtimeExecutable } from "./package-cli.ts";

describe("package-cli assetName", () => {
  test("names a unix executable with version, os and arch", () => {
    expect(assetName("1.2.3", "bun-linux-x64")).toBe("variant-1.2.3-linux-x64");
    expect(assetName("1.2.3", "bun-darwin-arm64")).toBe("variant-1.2.3-darwin-arm64");
  });

  test("gives Windows executables an .exe suffix", () => {
    expect(assetName("1.2.3", "bun-windows-x64")).toBe("variant-1.2.3-windows-x64.exe");
    expect(assetName("1.2.3", "bun-windows-arm64")).toBe("variant-1.2.3-windows-arm64.exe");
  });

  test("rejects a target that is not a release platform", () => {
    expect(() => assetName("1.2.3", "bun-linux-x64-baseline")).toThrow("unsupported target");
    expect(() => assetName("1.2.3", "bun-freebsd-x64")).toThrow("unsupported target");
  });
});

describe("package-cli embeddedAppModule", () => {
  test("imports every file of the app as an embedded file and maps its name to it", () => {
    const directory = mkdtempSync(join("/tmp", "variant-app-"));
    try {
      writeFileSync(join(directory, "index.html"), "<html>");
      writeFileSync(join(directory, "chunk-abc.js"), "1");
      mkdirSync(join(directory, "nested"));

      const module = embeddedAppModule(directory);

      expect(module).toContain(`from ${JSON.stringify(join(directory, "index.html"))} with { type: "file" }`);
      expect(module).toContain(`from ${JSON.stringify(join(directory, "chunk-abc.js"))} with { type: "file" }`);
      expect(module).toMatch(/export const embeddedApp = \{ .*"index\.html": file\d.*\};/);
      expect(module).not.toContain("nested");
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  test("compiling fails, saying so, when the app is not built", async () => {
    const root = mkdtempSync(join("/tmp", "variant-root-"));
    try {
      await expect(compileCli(root, join(root, "variant"))).rejects.toThrow("the variants app is not built");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("package-cli compileCli runtime", () => {
  test("fails on a missing runtime before it looks at the app, naming the path", async () => {
    const root = mkdtempSync(join("/tmp", "variant-root-"));
    const missing = join(root, "bun-standalone");
    try {
      await expect(compileCli(root, join(root, "variant"), undefined, { VARIANT_BUN_RUNTIME: missing })).rejects.toThrow(
        missing,
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

// Specification: openspec/specs/meta/dev-bleeds/spec.md (Optional runtime executable for compiled CLI)
describe("workflows", () => {
  test("leave VARIANT_BUN_RUNTIME to the release workflow", () => {
    const workflows = join(import.meta.dir, "..", ".github", "workflows");
    for (const name of readdirSync(workflows)) {
      if (name !== "ci-release.yaml") {
        expect(readFileSync(join(workflows, name), "utf8"), name).not.toContain("VARIANT_BUN_RUNTIME");
      }
    }
  });
});

describe("package-cli compileTargets", () => {
  test("expands all to the release platforms and keeps a single target as it is", () => {
    expect(compileTargets("all", {})).toEqual([...RELEASE_TARGETS]);
    expect(compileTargets("bun-darwin-arm64", {})).toEqual(["bun-darwin-arm64"]);
  });

  test("refuses all when one runtime is supplied, since it fits one platform", () => {
    expect(() => compileTargets("all", { VARIANT_BUN_RUNTIME: "/runtime/bun-standalone" })).toThrow("VARIANT_BUN_RUNTIME");
    expect(compileTargets("bun-darwin-arm64", { VARIANT_BUN_RUNTIME: "/runtime/bun-standalone" })).toEqual([
      "bun-darwin-arm64",
    ]);
  });
});

describe("package-cli runtimeExecutable", () => {
  test("names the executable that VARIANT_BUN_RUNTIME points at", () => {
    const directory = mkdtempSync(join("/tmp", "variant-runtime-"));
    try {
      const runtime = join(directory, "bun-standalone");
      writeFileSync(runtime, "#!/bin/sh\n");
      chmodSync(runtime, 0o755);

      expect(runtimeExecutable({ VARIANT_BUN_RUNTIME: runtime })).toBe(runtime);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  test("names no runtime when VARIANT_BUN_RUNTIME is unset or empty", () => {
    expect(runtimeExecutable({})).toBeUndefined();
    expect(runtimeExecutable({ VARIANT_BUN_RUNTIME: "" })).toBeUndefined();
  });

  test("fails naming the path when the runtime file does not exist", () => {
    const missing = join("/tmp", "variant-runtime-missing", "bun-standalone");

    expect(() => runtimeExecutable({ VARIANT_BUN_RUNTIME: missing })).toThrow(missing);
  });

  test("fails naming the path when the runtime file is not executable", () => {
    const directory = mkdtempSync(join("/tmp", "variant-runtime-"));
    try {
      const runtime = join(directory, "bun-standalone");
      writeFileSync(runtime, "bytes");
      chmodSync(runtime, 0o644);

      expect(() => runtimeExecutable({ VARIANT_BUN_RUNTIME: runtime })).toThrow(runtime);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
