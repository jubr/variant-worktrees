import { describe, expect, it } from "bun:test";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadConfig } from "variant-config";
import { parse as parseYaml } from "yaml";
import {
  clearVariantRuntime,
  isProcessAlive,
  readVariantRuntime,
  variantConfigDir,
  writeVariantRuntime,
} from "../src/runtime-state.js";

/** A repository whose variants.yaml sits in `subdir` ("" for the root) with a worktree `_v-demo` for slug demo. */
const withRepo = (subdir: string, run: (repo: string, worktree: string) => void): void => {
  const parent = realpathSync(mkdtempSync(join("/tmp", "variant-state-")));
  const repo = join(parent, "repo");
  const git = (...args: string[]) => execFileSync("git", ["-C", repo, ...args], { encoding: "utf8" });
  try {
    execFileSync("git", ["init", "-q", "-b", "main", repo]);
    git("config", "user.email", "variant@example.test");
    git("config", "user.name", "Variant Tests");
    mkdirSync(join(repo, subdir), { recursive: true });
    writeFileSync(join(repo, subdir, "variants.yaml"), "db:\n  dialect: sqlite\n");
    git("add", ".");
    git("commit", "-q", "-m", "initial");
    const worktree = join(repo, "_v-demo");
    git("worktree", "add", "-q", "-b", "feat/demo", worktree);
    run(repo, worktree);
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
};

describe("variantConfigDir", () => {
  it("is the worktree itself when variants.yaml sits at the repository root", () =>
    withRepo("", (repo, worktree) => {
      expect(variantConfigDir(loadConfig({ cwd: repo }), worktree)).toBe(worktree);
    }));

  it("re-bases a nested configuration directory onto the worktree", () =>
    withRepo("app", (repo, worktree) => {
      const config = loadConfig({ cwd: join(repo, "app") });

      expect(variantConfigDir(config, worktree)).toBe(join(worktree, "app"));
    }));

  it("re-bases a configuration that was loaded from another worktree", () =>
    withRepo("app", (repo, worktree) => {
      const config = loadConfig({ cwd: join(worktree, "app") });

      expect(variantConfigDir(config, repo)).toBe(join(repo, "app"));
    }));

  it("is the configuration directory outside a git repository", () => {
    const directory = realpathSync(mkdtempSync(join("/tmp", "variant-state-plain-")));
    try {
      writeFileSync(join(directory, "variants.yaml"), "db:\n  dialect: sqlite\n");

      expect(variantConfigDir(loadConfig({ cwd: directory }), directory)).toBe(directory);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});

describe("runtime state of a variant", () => {
  it("is written into the worktree, read back and cleared, keeping the rest of the file", () =>
    withRepo("", (repo, worktree) => {
      const config = loadConfig({ cwd: repo });
      const file = join(worktree, "variants.local.yaml");

      writeVariantRuntime(config, worktree, {
        slug: "demo",
        mode: "watch",
        instances: { fe: { port: 62060, pid: 7 } },
      });

      expect(parseYaml(readFileSync(file, "utf8"))).toEqual({
        runtime: { slug: "demo", mode: "watch", instances: { fe: { port: 62060, pid: 7 } } },
      });
      expect(readVariantRuntime(config, worktree)?.instances?.fe).toEqual({ port: 62060, pid: 7 });

      clearVariantRuntime(config, worktree);

      expect(readVariantRuntime(config, worktree)).toBeUndefined();
    }));

  it("reads nothing for a worktree without a file", () =>
    withRepo("", (repo, worktree) => {
      expect(readVariantRuntime(loadConfig({ cwd: repo }), worktree)).toBeUndefined();
    }));

  it("applies VARIANT_<KEY>_PORT overrides to the run's own state", () =>
    withRepo("", (repo, worktree) => {
      writeFileSync(join(repo, "variants.yaml"), "variant:\n  instances:\n    fe: { kind: vite, dir: fe }\n");
      const config = loadConfig({ cwd: repo });

      expect(readVariantRuntime(config, worktree, { VARIANT_FE_PORT: "62099" })?.instances?.fe?.port).toBe(62099);
    }));

  it("clearing without a file is a no-op", () =>
    withRepo("", (repo, worktree) => {
      clearVariantRuntime(loadConfig({ cwd: repo }), worktree);

      expect(existsSync(join(worktree, "variants.local.yaml"))).toBe(false);
    }));
});

describe("isProcessAlive", () => {
  it("is true for a running process", () => {
    expect(isProcessAlive(process.pid)).toBe(true);
  });

  it("is false for a process that has ended", () => {
    const finished = spawnSync("true");

    expect(finished.pid).toBeGreaterThan(0);
    expect(isProcessAlive(finished.pid)).toBe(false);
  });

  it("is true when the process exists but may not be signalled", () => {
    expect(isProcessAlive(1)).toBe(true);
  });
});
