import { afterEach, describe, expect, it } from "bun:test";
import { type ChildProcess, spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadConfig, readRuntime } from "variant-config";
import { stringify as stringifyYaml } from "yaml";
import { createClient } from "../index.js";
import { isProcessAlive } from "../runtime-state.js";
import { type EngineStub, installEngineStub } from "../test/engine-stub.js";

const CONFIG = [
  "db:",
  "  dialect: sqlite",
  "variant:",
  "  watches:",
  "    fe: { kind: vite, dir: fe, container: { dockerfile: fe/Dockerfile } }",
  "    be: { kind: nestjs, dir: be, container: { dockerfile: be/Dockerfile, internalPort: 3000 } }",
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
        `runtime:\n  slug: demo\n  mode: watch\n  watches:\n    fe: { port: 62060, pid: ${watcher.pid} }\n`,
      );

      const result = await down();

      expect(await untilDead(watcher.pid)).toBe(true);
      expect(await untilDead(watcher.child)).toBe(true);
      expect(result.processes).toEqual([{ key: "fe", pid: watcher.pid }]);
      expect(readRuntime(directory)).toEqual({ slug: "demo" });
      expect(existsSync(localFile)).toBe(true);
    }));

  it("drops the recorded watch log from the runtime and keeps the file", () =>
    withProject(async ({ directory, down, localFile }) => {
      const log = join(directory, "variants.watch.log");
      writeFileSync(log, "[fe] bun run dev\n");
      writeFileSync(localFile, `runtime:\n  slug: demo\n  mode: watch\n  log: ${log}\n`);

      await down();

      expect(readRuntime(directory)?.log).toBeUndefined();
      expect(readRuntime(directory)?.mode).toBeUndefined();
      expect(readFileSync(log, "utf8")).toBe("[fe] bun run dev\n");
    }));

  it("ignores a stale pid and still clears the runtime", () =>
    withProject(async ({ down, localFile, directory }) => {
      writeFileSync(localFile, "runtime:\n  slug: demo\n  watches:\n    fe: { pid: 2147483000 }\n");

      const result = await down();

      expect(result.processes).toEqual([]);
      expect(readRuntime(directory)?.watches).toBeUndefined();
    }));

  it("does not signal a recorded pid whose working directory is outside the worktree", () =>
    withProject(async ({ down, localFile }) => {
      const outsider = spawn("sleep", ["300"], { cwd: realpathSync("/"), detached: true, stdio: "ignore" });
      spawned.push(outsider);
      writeFileSync(localFile, `runtime:\n  slug: demo\n  watches:\n    fe: { pid: ${outsider.pid} }\n`);

      const result = await down();

      expect(result.processes).toEqual([]);
      expect(isProcessAlive(outsider.pid as number)).toBe(true);
    }));

  it("removes containers and the network through the engine", () =>
    withProject(async ({ engine, down }) => {
      engine.seed({ containers: ["v-fe-demo", "v-be-demo", "v-fe-other"], networks: ["v-net-demo", "v-net-other"] });

      const result = await down();

      expect(engine.state()).toEqual({ containers: ["v-fe-other"], networks: ["v-net-other"] });
      expect(result.containers.sort()).toEqual(["v-be-demo", "v-fe-demo"]);
      expect(result.networks).toEqual(["v-net-demo"]);
    }));

  it("clears only the runtime section and keeps data and state", () =>
    withProject(async ({ directory, down, localFile }) => {
      const stateDir = join(directory, ".cache", "variants");
      mkdirSync(stateDir, { recursive: true });
      writeFileSync(join(stateDir, "demo.db"), "rows");
      writeFileSync(join(stateDir, "demo.yaml"), "slug: demo\n");
      writeFileSync(localFile, "other: kept\nruntime:\n  slug: demo\n");

      await down();

      expect(readFileSync(localFile, "utf8")).toContain("other: kept");
      expect(readRuntime(directory)).toEqual({ slug: "demo" });
      expect(readFileSync(join(stateDir, "demo.db"), "utf8")).toBe("rows");
      expect(existsSync(join(stateDir, "demo.yaml"))).toBe(true);
    }));

  it("works for main", () =>
    withProject(async ({ directory, down, localFile }) => {
      const watcher = await startWatcher(join(directory, "fe"));
      writeFileSync(localFile, `runtime:\n  slug: main\n  watches:\n    fe: { pid: ${watcher.pid} }\n`);

      const result = await down("main");

      expect(result.slug).toBe("main");
      expect(await untilDead(watcher.pid)).toBe(true);
    }));

  it("leaves the variant-ui server of main running and recorded", () =>
    withProject(async ({ directory, down, localFile }) => {
      const watcher = await startWatcher(join(directory, "fe"));
      const server = await startWatcher(join(directory, "be"));
      const ui = { port: 62100, pid: server.pid, url: "http://ui.vw.localhost:62100" };
      writeFileSync(
        localFile,
        stringifyYaml({
          runtime: { slug: "main", watches: { fe: { pid: watcher.pid }, "variant-ui": ui } },
        }),
      );

      const result = await down("main");

      expect(result.processes.map(({ key }) => key)).toEqual(["fe"]);
      expect(await untilDead(watcher.pid)).toBe(true);
      expect(isProcessAlive(server.pid)).toBe(true);
      expect(readRuntime(directory)?.watches).toEqual({ "variant-ui": ui });
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
