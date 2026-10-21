import { afterEach, describe, expect, it } from "bun:test";
import { type ChildProcess, spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadConfig } from "variant-config";
import { createClient } from "../src/index.js";
import { isProcessAlive } from "../src/runtime-state.js";

const spawned: ChildProcess[] = [];
afterEach(() => {
  for (const child of spawned.splice(0)) {
    try {
      process.kill(-(child.pid as number), "SIGKILL");
    } catch {
      // already gone
    }
  }
});

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const withProject = async (
  run: (directory: string, implode: (slug?: string) => Promise<unknown>) => Promise<void>,
): Promise<void> => {
  const directory = realpathSync(mkdtempSync(join("/tmp", "variant-implode-")));
  try {
    mkdirSync(join(directory, "fe"));
    writeFileSync(
      join(directory, "variants.yaml"),
      "db:\n  dialect: sqlite\nvariant:\n  storage: {}\n  instances:\n    fe: { kind: vite, dir: fe }\n",
    );
    const client = createClient({
      config: loadConfig({ cwd: directory, env: {} }),
      cwd: directory,
      stateDir: join(directory, ".cache", "variants"),
      worktree: false,
    });
    await client.create("demo");
    await run(directory, (slug = "demo") => client.implode(slug));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
};

describe("implode teardown", () => {
  it("stops the recorded runtime, drops the database, deletes storage and clears the runtime section", () =>
    withProject(async (directory, implode) => {
      const watcher = spawn("sleep", ["300"], { cwd: join(directory, "fe"), detached: true, stdio: "ignore" });
      spawned.push(watcher);
      mkdirSync(join(directory, ".storage"));
      writeFileSync(join(directory, ".storage", "upload.bin"), "data");
      writeFileSync(
        join(directory, "variants.local.yaml"),
        `runtime:\n  slug: demo\n  mode: watch\n  instances:\n    fe: { pid: ${watcher.pid} }\n`,
      );
      await sleep(50);

      expect(await implode()).toMatchObject({ slug: "demo", removed: true });

      for (let attempt = 0; attempt < 100 && isProcessAlive(watcher.pid as number); attempt += 1) {
        await sleep(50);
      }
      expect(isProcessAlive(watcher.pid as number)).toBe(false);
      expect(existsSync(join(directory, ".cache", "variants", "demo.db"))).toBe(false);
      expect(existsSync(join(directory, ".cache", "variants", "demo.yaml"))).toBe(false);
      expect(existsSync(join(directory, ".storage"))).toBe(false);
      expect(existsSync(join(directory, "variants.local.yaml"))).toBe(false);
    }));

  it("refuses main and names the primary checkout", () =>
    withProject(async (_directory, implode) => {
      await expect(implode("main")).rejects.toThrow("primary checkout");
    }));

  it("succeeds without changes for a variant that does not exist", () =>
    withProject(async (directory, implode) => {
      expect(await implode("nonexistent")).toMatchObject({ slug: "nonexistent", removed: false });
      expect(readFileSync(join(directory, "variants.yaml"), "utf8")).toContain("storage");
    }));
});
