/**
 * Specification: openspec/specs/meta/release-artifacts/spec.md (Release contents)
 * Specification: openspec/specs/meta/dev-bleeds/spec.md (Optional runtime executable for compiled CLI)
 */
import { describe, expect, test } from "bun:test";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  RELEASE_TARGETS,
  assetName,
  compileCli,
  compileTargets,
  embeddedAppModule,
  runtimeDefines,
  runtimeExecutable,
  selectRuntime,
} from "./package-cli.ts";

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

// Specification: openspec/specs/meta/dev-bleeds/spec.md (Optional runtime executable for compiled CLI)
describe("package-cli selectRuntime", () => {
  const said: string[] = [];
  const say = (level: "info" | "warn", message: string): void => {
    said.push(`${level}: ${message}`);
  };
  const neverFetch = (): string => {
    throw new Error("must not fetch");
  };

  const executable = (directory: string, ...path: string[]): string => {
    const file = join(directory, ...path);
    mkdirSync(join(file, ".."), { recursive: true });
    writeFileSync(file, "#!/bin/sh\n");
    chmodSync(file, 0o755);
    return file;
  };

  test("takes the runtime VARIANT_BUN_RUNTIME names, without fetching, and says so", () => {
    const directory = mkdtempSync(join("/tmp", "variant-runtime-"));
    try {
      said.length = 0;
      const runtime = executable(directory, "bun-standalone");

      const choice = selectRuntime("bun-darwin-arm64", { env: { VARIANT_BUN_RUNTIME: runtime }, fetchSlim: neverFetch, say });

      expect(choice).toEqual({ executablePath: runtime, source: "external" });
      expect(said).toEqual([`info: bun-darwin-arm64: runtime from VARIANT_BUN_RUNTIME: ${runtime}`]);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  test("names the build of a bun-slim release directory in the external runtime", () => {
    const directory = mkdtempSync(join("/tmp", "variant-runtime-"));
    try {
      const runtime = executable(directory, "bun-slim-darwin-arm64-v1.4.5-0", "bun-slim");

      expect(
        selectRuntime("bun-darwin-arm64", { env: { VARIANT_BUN_RUNTIME: runtime }, fetchSlim: neverFetch, say: () => {} }),
      ).toEqual({ executablePath: runtime, source: "external", build: "0" });
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  test("fails naming the path when VARIANT_BUN_RUNTIME names no executable, without fetching", () => {
    expect(() =>
      selectRuntime("bun-darwin-arm64", { env: { VARIANT_BUN_RUNTIME: "/tmp/variant-missing/bun" }, fetchSlim: neverFetch, say }),
    ).toThrow("/tmp/variant-missing/bun");
  });

  test("fetches the slim runtime of the platform for a Linux or macOS target, and says which build", () => {
    const directory = mkdtempSync(join("/tmp", "variant-runtime-"));
    try {
      said.length = 0;
      const runtime = executable(directory, "bun-slim-linux-arm64-v1.4.5-3", "bun-slim");
      const platforms: string[] = [];

      const choice = selectRuntime("bun-linux-arm64", {
        env: {},
        fetchSlim: (platform) => {
          platforms.push(platform);
          return runtime;
        },
        say,
      });

      expect(platforms).toEqual(["linux-arm64"]);
      expect(choice).toEqual({ executablePath: runtime, source: "slim", build: "3" });
      expect(said).toEqual([`info: bun-linux-arm64: runtime bun-slim-v1.4.5-3 fetched from jubr/bun-slim: ${runtime}`]);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  test("treats an empty VARIANT_BUN_RUNTIME as unset", () => {
    const choice = selectRuntime("bun-darwin-x64", { env: { VARIANT_BUN_RUNTIME: "" }, fetchSlim: () => "/tmp/slim/bun-slim", say: () => {} });

    expect(choice.source).toBe("slim");
  });

  test("warns with the reason and takes the default runtime when the fetch fails", () => {
    said.length = 0;

    const choice = selectRuntime("bun-linux-x64", {
      env: {},
      fetchSlim: () => {
        throw new Error("jubr/bun-slim has no release for Bun 9.9.9\nsecond line");
      },
      say,
    });

    expect(choice).toEqual({ source: "default" });
    expect(said).toEqual([
      "warn: bun-linux-x64: no slim runtime (jubr/bun-slim has no release for Bun 9.9.9); runtime bun-dist, the default Bun runtime",
    ]);
  });

  test("takes the default runtime for Windows without fetching, and says that Windows has no slim runtime", () => {
    said.length = 0;

    for (const target of ["bun-windows-x64", "bun-windows-arm64"]) {
      expect(selectRuntime(target, { env: {}, fetchSlim: neverFetch, say })).toEqual({ source: "default" });
    }

    expect(said).toEqual([
      "info: bun-windows-x64: runtime bun-dist, the default Bun runtime (Windows has no slim runtime)",
      "info: bun-windows-arm64: runtime bun-dist, the default Bun runtime (Windows has no slim runtime)",
    ]);
  });
});

describe("package-cli runtimeDefines", () => {
  test("stamps the build number of the embedded runtime for the version line", () => {
    expect(runtimeDefines({ executablePath: "/runtime/bun-slim", source: "slim", build: "3" })).toEqual({
      VARIANT_BUILD_RUNTIME: '"3"',
    });
  });

  test("stamps nothing for a runtime without a build number", () => {
    expect(runtimeDefines({ source: "default" })).toEqual({});
    expect(runtimeDefines({ executablePath: "/runtime/bun", source: "external" })).toEqual({});
  });
});
