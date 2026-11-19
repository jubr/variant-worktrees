import { describe, expect, it } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import esbuild, { type BuildOptions } from "esbuild";
import { loadConfig } from "variant-config";

/**
 * Specification: openspec/specs/variant-api/runtime/spec.md
 * The extension spawns dist/watch-relay.js. That ESM bundle has to stay up long enough to report pids.
 */
describe("bundled watch relay", () => {
  it("reports pids when node runs the ESM bundle", async () => {
    const builds = await import("../scripts/esbuild.config.ts");
    const directory = realpathSync(mkdtempSync(join("/tmp", "variant-watch-relay-")));
    const outfile = join(directory, "watch-relay.js");
    writeFileSync(join(directory, "package.json"), JSON.stringify({ type: "module" }));
    let started: ReturnType<typeof Bun.spawn> | undefined;
    try {
      await buildBundle(builds.watchRelayBundle as BuildOptions, outfile);
      const plan = {
        launches: [
          {
            key: "fe",
            command: "sleep 30",
            cwd: directory,
            env: { PATH: process.env.PATH ?? "" },
          },
        ],
        startDelayMs: 0,
        logPath: join(directory, "watch.log"),
      };
      started = Bun.spawn(["node", outfile], {
        cwd: directory,
        stdin: new Blob([JSON.stringify(plan)]),
        stdout: "pipe",
        stderr: "pipe",
      });
      const { line, stderr } = await firstLine(started, 15_000);
      if (!line.startsWith("{")) {
        throw new Error(`relay wrote ${JSON.stringify(line)}: ${stderr}`);
      }
      const message = JSON.parse(line) as { pids?: Record<string, number>; error?: string };
      if (message.error !== undefined || message.pids?.fe === undefined) {
        throw new Error(`relay wrote ${line}: ${stderr}`);
      }
      expect(message.pids.fe).toBeGreaterThan(0);
      try {
        process.kill(-message.pids.fe, "SIGKILL");
      } catch {
        try {
          process.kill(message.pids.fe, "SIGKILL");
        } catch {
          // The sleep may already be gone.
        }
      }
    } finally {
      started?.kill();
      rmSync(directory, { recursive: true, force: true });
    }
  }, 60_000);

  it("stops its watches and implodes the variant when node runs the bundle and the worktree is removed", async () => {
    const builds = await import("../scripts/esbuild.config.ts");
    const project = realpathSync(mkdtempSync(join("/tmp", "variant-watch-relay-")));
    const bundle = join(project, "bundle");
    const worktree = join(project, "_v-demo");
    const stateDir = join(project, ".cache", "variants");
    const stateFile = join(stateDir, "demo.yaml");
    let started: ReturnType<typeof Bun.spawn> | undefined;
    let fe: number | undefined;
    try {
      mkdirSync(bundle);
      mkdirSync(worktree);
      mkdirSync(stateDir, { recursive: true });
      writeFileSync(stateFile, "slug: demo\n");
      writeFileSync(join(bundle, "package.json"), JSON.stringify({ type: "module" }));
      writeFileSync(
        join(project, "variants.yaml"),
        "db:\n  dialect: sqlite\nvariant:\n  watches:\n    fe: { kind: vite, dir: . }\n",
      );
      await buildBundle(builds.watchRelayBundle as BuildOptions, join(bundle, "watch-relay.js"));
      const plan = {
        launches: [{ key: "fe", command: "sleep 300", cwd: worktree, env: { PATH: process.env.PATH ?? "" } }],
        startDelayMs: 0,
        logPath: join(worktree, ".cache", "variant", "watch.log"),
        cleanup: {
          slug: "demo",
          worktree,
          cwd: project,
          stateDir,
          config: loadConfig({ cwd: project, env: {} }),
          useWorktree: true,
          pollSeconds: 1,
        },
      };
      started = Bun.spawn(["node", join(bundle, "watch-relay.js")], {
        cwd: project,
        stdin: new Blob([JSON.stringify(plan)]),
        stdout: "pipe",
        stderr: "pipe",
      });
      const { line, stderr } = await firstLine(started, 15_000);
      if (!line.startsWith("{")) {
        throw new Error(`relay wrote ${JSON.stringify(line)}: ${stderr}`);
      }
      fe = (JSON.parse(line) as { pids: Record<string, number> }).pids.fe;

      rmSync(worktree, { recursive: true, force: true });
      const exit = await Promise.race([
        started.exited,
        new Promise<"timeout">((resolve) => setTimeout(() => resolve("timeout"), 20_000)),
      ]);

      expect(exit).toBe(0);
      expect(existsSync(stateFile)).toBe(false);
      expect(existsSync(worktree)).toBe(false);
    } finally {
      for (const pid of [fe]) {
        if (pid !== undefined) {
          try {
            process.kill(-pid, "SIGKILL");
          } catch {
            // already gone
          }
        }
      }
      started?.kill();
      rmSync(project, { recursive: true, force: true });
    }
  }, 60_000);
});

/** esbuild's service dies when a neighbour test is killed. One more start is enough. */
const buildBundle = async (options: BuildOptions, outfile: string): Promise<void> => {
  const build = {
    ...options,
    absWorkingDir: join(import.meta.dir, ".."),
    outfile,
    logLevel: "silent" as const,
  };
  try {
    await esbuild.build(build);
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes("service is no longer running")) {
      throw error;
    }
    await esbuild.build(build);
  }
};

const firstLine = async (
  proc: ReturnType<typeof Bun.spawn>,
  timeoutMs: number,
): Promise<{ line: string; stderr: string }> => {
  const reader = proc.stdout.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const timer = setTimeout(() => proc.kill(), timeoutMs);
  try {
    while (!buffer.includes("\n")) {
      const next = await reader.read();
      if (next.done) {
        break;
      }
      buffer += decoder.decode(next.value, { stream: true });
    }
  } finally {
    clearTimeout(timer);
  }
  const newline = buffer.indexOf("\n");
  if (newline === -1) {
    proc.kill();
    return { line: buffer, stderr: await new Response(proc.stderr).text() };
  }
  return { line: buffer.slice(0, newline), stderr: "" };
};
