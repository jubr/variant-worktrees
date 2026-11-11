import { describe, expect, it } from "bun:test";
import { mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import esbuild, { type BuildOptions } from "esbuild";

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
