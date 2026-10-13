import { afterEach, describe, expect, it } from "bun:test";
import { type ChildProcess, spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadConfig } from "variant-config";
import { parse as parseYaml } from "yaml";
import { createClient } from "../src/index.js";
import { isProcessAlive } from "../src/runtime-state.js";
import { type EngineStub, installEngineStub } from "./support/engine-stub.js";

const CONFIG = [
  "db:",
  "  dialect: sqlite",
  "variant:",
  "  instances:",
  "    fe: { kind: vite, dir: fe, container: { static: dist } }",
  "    be: { kind: nestjs, dir: be, container: { image: app, port: 3000 } }",
  "",
].join("\n");

const spawned: ChildProcess[] = [];
const originalPath = process.env.PATH;
afterEach(() => {
  process.env.PATH = originalPath;
  for (const child of spawned.splice(0)) {
    try {
      if (child.pid) {
        process.kill(-child.pid, "SIGKILL");
      }
    } catch {
      // already gone
    }
  }
});

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));
const untilDead = async (pid: number): Promise<boolean> => {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (!isProcessAlive(pid)) {
      return true;
    }
    await sleep(50);
  }
  return false;
};

/** A detached `sh` in `cwd` that starts a background `sleep` and records its pid in `child.pid`. */
const startWatcher = async (cwd: string): Promise<{ pid: number; child: number }> => {
  const child = spawn("sh", ["-c", "sleep 300 & echo $! > child.pid; wait"], { cwd, detached: true, stdio: "ignore" });
  spawned.push(child);
  for (let attempt = 0; attempt < 100 && !existsSync(join(cwd, "child.pid")); attempt += 1) {
    await sleep(20);
  }
  await sleep(20);
  return { pid: child.pid as number, child: Number(readFileSync(join(cwd, "child.pid"), "utf8")) };
};

interface Project {
  directory: string;
  engine: EngineStub;
  down: (slug?: string) => ReturnType<ReturnType<typeof createClient>["down"]>;
  localFile: string;
}

const withProject = async (run: (project: Project) => Promise<void>, yaml = CONFIG): Promise<void> => {
  const directory = realpathSync(mkdtempSync(join("/tmp", "variant-down-")));
  try {
    mkdirSync(join(directory, "fe"));
    mkdirSync(join(directory, "be"));
    writeFileSync(join(directory, "variants.yaml"), yaml);
    const engine = installEngineStub(directory);
    process.env.PATH = `${engine.bin}:${originalPath}`;
    const client = () =>
      createClient({
        config: loadConfig({ cwd: directory, env: {} }),
        cwd: directory,
        stateDir: join(directory, ".cache", "variants"),
        worktree: false,
      });
    await run({
      directory,
      engine,
      down: (slug = "demo") => client().down(slug),
      localFile: join(directory, "variants.local.yaml"),
    });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
};

describe("down", () => {
  it("terminates recorded host processes together with their children and clears the runtime", () =>
    withProject(async ({ directory, down, localFile }) => {
      const watcher = await startWatcher(join(directory, "fe"));
      writeFileSync(
        localFile,
        `runtime:\n  slug: demo\n  mode: watch\n  instances:\n    fe: { port: 62060, pid: ${watcher.pid} }\n`,
      );

      const result = await down();

      expect(await untilDead(watcher.pid)).toBe(true);
      expect(await untilDead(watcher.child)).toBe(true);
      expect(result.processes).toEqual([{ key: "fe", pid: watcher.pid }]);
      expect(existsSync(localFile)).toBe(false);
    }));

  it("ignores a stale pid and still clears the runtime", () =>
    withProject(async ({ down, localFile }) => {
      writeFileSync(localFile, "runtime:\n  slug: demo\n  instances:\n    fe: { pid: 2147483000 }\n");

      const result = await down();

      expect(result.processes).toEqual([]);
      expect(existsSync(localFile)).toBe(false);
    }));

  it("does not signal a recorded pid whose working directory is outside the worktree", () =>
    withProject(async ({ down, localFile }) => {
      const outsider = spawn("sleep", ["300"], { cwd: realpathSync("/"), detached: true, stdio: "ignore" });
      spawned.push(outsider);
      writeFileSync(localFile, `runtime:\n  slug: demo\n  instances:\n    fe: { pid: ${outsider.pid} }\n`);

      const result = await down();

      expect(result.processes).toEqual([]);
      expect(isProcessAlive(outsider.pid as number)).toBe(true);
    }));

  it("removes containers, the network and generated nginx configuration through the engine", () =>
    withProject(async ({ directory, engine, down }) => {
      engine.seed({ containers: ["v-fe-demo", "v-be-demo", "v-fe-other"], networks: ["v-net-demo", "v-net-other"] });
      const stateDir = join(directory, ".cache", "variants");
      mkdirSync(stateDir, { recursive: true });
      writeFileSync(join(stateDir, "demo.fe.nginx.conf"), "server {}\n");
      writeFileSync(join(stateDir, "other.fe.nginx.conf"), "server {}\n");

      const result = await down();

      expect(engine.state()).toEqual({ containers: ["v-fe-other"], networks: ["v-net-other"] });
      expect(result.containers.sort()).toEqual(["v-be-demo", "v-fe-demo"]);
      expect(result.networks).toEqual(["v-net-demo"]);
      expect(existsSync(join(stateDir, "demo.fe.nginx.conf"))).toBe(false);
      expect(existsSync(join(stateDir, "other.fe.nginx.conf"))).toBe(true);
    }));

  it("clears only the runtime section and keeps data and state", () =>
    withProject(async ({ directory, down, localFile }) => {
      const stateDir = join(directory, ".cache", "variants");
      mkdirSync(stateDir, { recursive: true });
      writeFileSync(join(stateDir, "demo.db"), "rows");
      writeFileSync(join(stateDir, "demo.yaml"), "slug: demo\n");
      writeFileSync(localFile, "other: kept\nruntime:\n  slug: demo\n");

      await down();

      expect(parseYaml(readFileSync(localFile, "utf8"))).toEqual({ other: "kept" });
      expect(readFileSync(join(stateDir, "demo.db"), "utf8")).toBe("rows");
      expect(existsSync(join(stateDir, "demo.yaml"))).toBe(true);
    }));

  it("works for main", () =>
    withProject(async ({ directory, down, localFile }) => {
      const watcher = await startWatcher(join(directory, "fe"));
      writeFileSync(localFile, `runtime:\n  slug: main\n  instances:\n    fe: { pid: ${watcher.pid} }\n`);

      const result = await down("main");

      expect(result.slug).toBe("main");
      expect(await untilDead(watcher.pid)).toBe(true);
    }));

  it("succeeds and reports nothing stopped when nothing runs", () =>
    withProject(async ({ down }) => {
      expect(await down()).toEqual({ slug: "demo", processes: [], containers: [], networks: [] });
    }));

  it("succeeds without a container engine", () =>
    withProject(async ({ down }) => {
      process.env.PATH = "/nonexistent";

      expect((await down()).containers).toEqual([]);
    }));
});
