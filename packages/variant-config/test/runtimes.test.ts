import { describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { readRuntimes } from "../src/index.js";

const withRoot = (run: (root: string, put: (path: string, content?: string) => void) => void): void => {
  const root = mkdtempSync(join("/tmp", "variant-runtimes-"));
  const put = (path: string, content = "") => {
    const full = join(root, path);
    mkdirSync(join(full, ".."), { recursive: true });
    writeFileSync(full, content);
  };
  try {
    run(root, put);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
};

const runtime = (slug: string, extra = ""): string => `runtime:\n  slug: ${slug}\n${extra}`;

describe("readRuntimes", () => {
  it("returns the runtime of every prefixed worktree with its directory", () =>
    withRoot((root, put) => {
      put("_v-demo/variants.local.yaml", runtime("demo"));
      put("_v-other/variants.local.yaml", runtime("other"));

      const { states, errors } = readRuntimes({ root, prefix: "_v-", main: join(root, "main") });

      expect(states).toEqual([
        { dir: join(root, "_v-demo"), runtime: { slug: "demo" } },
        { dir: join(root, "_v-other"), runtime: { slug: "other" } },
      ]);
      expect(errors).toEqual([]);
    }));

  it("includes the main checkout beside the root", () =>
    withRoot((root, put) => {
      put("_v-demo/variants.local.yaml", runtime("demo"));
      put("variant-worktrees/variants.local.yaml", runtime("main"));

      const { states } = readRuntimes({ root, prefix: "_v-", main: join(root, "variant-worktrees") });

      expect(states.map((state) => state.runtime.slug).sort()).toEqual(["demo", "main"]);
    }));

  it("includes the root itself when it is the main checkout, once", () =>
    withRoot((root, put) => {
      put("variants.local.yaml", runtime("main"));
      put("_v-demo/variants.local.yaml", runtime("demo"));

      const { states } = readRuntimes({ root, prefix: "_v-", main: root });

      expect(states.map((state) => state.runtime.slug).sort()).toEqual(["demo", "main"]);
    }));

  it("ignores other directories and nested files", () =>
    withRoot((root, put) => {
      put("scratch/variants.local.yaml", runtime("scratch"));
      put("_v-demo/packages/x/variants.local.yaml", runtime("nested"));

      expect(readRuntimes({ root, prefix: "_v-", main: join(root, "main") }).states).toEqual([]);
    }));

  it("searches only the configured prefix", () =>
    withRoot((root, put) => {
      put("_v-old/variants.local.yaml", runtime("old"));
      put("_work-demo/variants.local.yaml", runtime("demo"));

      const { states } = readRuntimes({ root, prefix: "_work-", main: join(root, "main") });

      expect(states.map((state) => state.runtime.slug)).toEqual(["demo"]);
    }));

  it("skips a file without a runtime section", () =>
    withRoot((root, put) => {
      put("_v-demo/variants.local.yaml", "# no runtime yet\n");

      expect(readRuntimes({ root, prefix: "_v-", main: join(root, "main") })).toEqual({ states: [], errors: [] });
    }));

  it("reports an invalid file by directory and still returns the valid ones", () =>
    withRoot((root, put) => {
      put("_v-bad/variants.local.yaml", "runtime:\n  nope: 1\n");
      put("_v-demo/variants.local.yaml", runtime("demo"));

      const { states, errors } = readRuntimes({ root, prefix: "_v-", main: join(root, "main") });

      expect(states.map((state) => state.runtime.slug)).toEqual(["demo"]);
      expect(errors.map((error) => error.dir)).toEqual([join(root, "_v-bad")]);
      expect(errors[0]?.message).not.toBe("");
    }));

  it("replaces environment templates and ignores VARIANT_* overrides", () =>
    withRoot((root, put) => {
      put(
        "_v-demo/variants.local.yaml",
        runtime("demo", "  db:\n    port: '{{POSTGRES_PORT}}'\n  instances:\n    be:\n      port: 62060\n"),
      );

      const { states } = readRuntimes({
        root,
        prefix: "_v-",
        main: join(root, "main"),
        env: { POSTGRES_PORT: "5433", VARIANT_BE_PORT: "62099" },
      });

      expect(states[0]?.runtime).toEqual({ slug: "demo", db: { port: 5433 }, instances: { be: { port: 62060 } } });
    }));
});
