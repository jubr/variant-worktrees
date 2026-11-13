/**
 * Specification: openspec/specs/variant-api/node-runtime/spec.md
 *
 * These tests run the built library (`dist/`) in a child process: `bun run test` builds `variant-api` first.
 */
import { describe, expect, it } from "bun:test";
import { execFileSync } from "node:child_process";
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const dist = join(import.meta.dir, "../dist");
/**
 * `bunfig.toml` sets `[run] bun = true`, so `bun run` puts bun on `PATH` as `node`.
 * The Node install from Mise is the process these tests mean by Node.
 */
const hostNode = execFileSync("mise", ["which", "node"], { encoding: "utf8" }).trim();
const entries = {
  index: pathToFileURL(join(dist, "index.js")).href,
  commands: pathToFileURL(join(dist, "commands.js")).href,
};

/** Runs an ES module `script` under `runtime` and returns what it printed. */
const run = async (
  runtime: "node" | "bun",
  script: string,
): Promise<{ stdout: string; stderr: string; exitCode: number }> => {
  const command = runtime === "node" ? ["node", "--input-type=module", "-e", script] : ["bun", "-e", script];
  const proc = Bun.spawn(command, { stdout: "pipe", stderr: "pipe", env: { ...process.env, VARIANT_WORKTREE: "0" } });
  const [exitCode, stdout, stderr] = await Promise.all([
    proc.exited,
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  return { stdout, stderr, exitCode };
};

describe("variant-api on Node and Bun", () => {
  it("declares Node 22.13 as the floor", () => {
    const manifest = JSON.parse(readFileSync(join(import.meta.dir, "../package.json"), "utf8"));
    expect(manifest.engines.node).toBe(">=22.13.0");
  });

  for (const entry of ["index.js", "commands.js"]) {
    it(`builds ${entry} without a Bun-only module or global at load time`, () => {
      const source = readFileSync(join(dist, entry), "utf8");
      expect(source).not.toMatch(/(?:from|import)\s*\(?\s*["']bun:/);
      expect(source).not.toMatch(/\bBun\./);
    });
  }

  for (const runtime of ["node", "bun"] as const) {
    it(`imports the built library and its commands under ${runtime}`, async () => {
      const result = await run(
        runtime,
        `const api = await import(${JSON.stringify(entries.index)});
         const commands = await import(${JSON.stringify(entries.commands)});
         console.log(typeof api.createVariantClient, typeof commands.commands);`,
      );
      expect(result.stderr).toBe("");
      expect(result.stdout.trim()).toBe("function object");
      expect(result.exitCode).toBe(0);
    });
  }

  for (const runtime of ["node", "bun"] as const) {
    it(`creates, lists and removes a SQLite variant under ${runtime}`, async () => {
      const directory = realpathSync(mkdtempSync(join("/tmp", "variant-node-sqlite-")));
      try {
        writeFileSync(join(directory, "variants.yaml"), "db:\n  dialect: sqlite\n");
        execFileSync("git", ["init", "-q", "-b", "main", directory]);
        execFileSync("git", ["-C", directory, "config", "user.email", "variant@example.test"]);
        execFileSync("git", ["-C", directory, "config", "user.name", "Variant Tests"]);
        execFileSync("git", ["-C", directory, "commit", "-q", "--allow-empty", "-m", "initial"]);
        const result = await run(
          runtime,
          `import { existsSync } from "node:fs";
           const { createVariantClient } = await import(${JSON.stringify(entries.index)});
           const client = createVariantClient({ cwd: ${JSON.stringify(directory)}, configPath: ${JSON.stringify(join(directory, "variants.yaml"))}, worktree: true });
           const file = ${JSON.stringify(join(directory, ".cache/variants/test-feature.db"))};
           const state = ${JSON.stringify(join(directory, "_v-test-feature", ".cache/variant/state.yaml"))};
           await client.create("test-feature");
           const database = existsSync(file);
           const stateWritten = existsSync(state);
           const listed = (await client.list()).map((record) => record.slug);
           await client.implode("test-feature");
           console.log(JSON.stringify({ database, stateWritten, listed, removed: !existsSync(state), after: (await client.list()).map((record) => record.slug) }));`,
        );
        expect(result.stderr.trim()).toBe("");
        expect(JSON.parse(result.stdout)).toEqual({
          database: false,
          stateWritten: true,
          listed: ["test-feature"],
          removed: true,
          after: [],
        });
      } finally {
        rmSync(directory, { recursive: true, force: true });
      }
    });
  }

  for (const runtime of ["node", "bun"] as const) {
    it(`removes the untracked files matching the preRm patterns under ${runtime}`, async () => {
      const parent = realpathSync(mkdtempSync(join("/tmp", "variant-node-implode-")));
      try {
        const result = await run(
          runtime,
          `import { execFileSync } from "node:child_process";
           import { existsSync, mkdirSync, writeFileSync } from "node:fs";
           import { join } from "node:path";
           const { createVariantClient } = await import(${JSON.stringify(entries.index)});
           const repo = join(${JSON.stringify(parent)}, "repo");
           const git = (...args) => execFileSync("git", ["-C", repo, ...args], { encoding: "utf8" });
           const put = (root, path, content = "x\\n") => { mkdirSync(join(root, path, ".."), { recursive: true }); writeFileSync(join(root, path), content); };
           execFileSync("git", ["init", "-q", "-b", "main", repo]);
           git("config", "user.email", "variant@example.test");
           git("config", "user.name", "Variant Tests");
           put(repo, "variants.yaml", "db:\\n  dialect: sqlite\\nvariant:\\n  implode:\\n    preRm: ['{out,dist}/**', '.cache/*', 'rec/\${slug}/pr*-demo.webm', 'tracked/*.js']\\n");
           put(repo, "tracked/keep.js");
           git("add", ".");
           git("commit", "-q", "-m", "initial");
           const client = createVariantClient({ cwd: repo, configPath: join(repo, "variants.yaml"), stateDir: join(repo, ".state") });
           const { worktree } = await client.create("demo");
           for (const path of ["out/a/b.js", "dist/c.js", ".cache/d", "rec/demo/pr7-demo.webm", "src/keep.js", "tracked/new.js"]) put(worktree, path);
           const { report } = await client.implode("demo", { force: true, log: () => {} });
           console.log(JSON.stringify(report));`,
        );
        expect(result.stderr).toBe("");
        const report = JSON.parse(result.stdout) as string;
        // `git status` of the worktree after the matching files were removed
        expect(report).toContain("src/");
        for (const removed of ["out/", "dist/", ".cache/", "pr7-demo.webm", "tracked/new.js"]) {
          expect(report).not.toContain(removed);
        }
      } finally {
        rmSync(parent, { recursive: true, force: true });
      }
    });
  }

  it("loads no sqlite module when a PostgreSQL client is used under Node", async () => {
    const directory = realpathSync(mkdtempSync(join("/tmp", "variant-node-pg-")));
    try {
      writeFileSync(
        join(directory, "variants.yaml"),
        "db:\n  dialect: postgres\n  url: postgres://u:p@127.0.0.1:1/db\n",
      );
      const result = await run(
        "node",
        `const { createVariantClient } = await import(${JSON.stringify(entries.index)});
         const client = createVariantClient({ cwd: ${JSON.stringify(directory)}, configPath: ${JSON.stringify(join(directory, "variants.yaml"))}, worktree: false });
         await client.list().catch(() => undefined);
         console.log(process.moduleLoadList.filter((name) => name.includes("sqlite")).length);`,
      );
      expect(result.stdout.trim()).toBe("0");
      expect(result.exitCode).toBe(0);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});

const writeExecutable = (path: string, body: string): void => {
  writeFileSync(path, body);
  chmodSync(path, 0o755);
};

interface NodeTtyProbe {
  /** Exit status of the `mise exec -- bun` probe. */
  project: number;
  /** Exit status of the `mise exec bun@latest -- bun` probe. */
  latest: number;
  /** Exit status of the `bun` on `PATH` probe. */
  pathBun: number;
  /** `script` on `PATH` runs the real program. Absent means `script` is not on `PATH`. */
  script: boolean;
}

/** A Node process, stub allocators, and one attached `tty` watch. The call log is every stub invocation. */
const watchTtyOnNode = async (
  probe: NodeTtyProbe,
): Promise<{ stdout: string; stderr: string; log: string; calls: string; exitCode: number }> => {
  const directory = realpathSync(mkdtempSync(join("/tmp", "variant-node-tty-")));
  const bin = join(directory, "bin");
  const calls = join(directory, "calls");
  mkdirSync(bin);
  writeFileSync(calls, "");
  writeFileSync(
    join(directory, "probe.js"),
    [
      "const tty = process.stdout.isTTY === true;",
      'console.log(tty ? "tty" : "pipe");',
      'console.log(tty ? "\\u001b[32mgreen\\u001b[0m" : "plain");',
      'process.stderr.write("oops\\n");',
      "process.stdin.resume();",
      'process.stdin.on("end", () => { if (tty) { console.log("stdin-end"); process.exit(0); } });',
      "setInterval(() => {}, 1000);",
      "",
    ].join("\n"),
  );
  writeFileSync(
    join(directory, "variants.yaml"),
    [
      "db:",
      "  dialect: sqlite",
      "variant:",
      "  supervise: { startDelaySeconds: 0, readyTimeoutSeconds: 1, checkoutPollSeconds: 0 }",
      "  watches:",
      "    fe:",
      "      dir: .",
      `      watch: ${JSON.stringify(`${hostNode} probe.js`)}`,
      "      output: { mode: tty }",
      "",
    ].join("\n"),
  );
  writeFileSync(
    join(directory, "drive.mjs"),
    [
      'import { readFileSync } from "node:fs";',
      'import { setTimeout as delay } from "node:timers/promises";',
      "const { createVariantClient, setLogSink } = await import(process.env.API);",
      'if (typeof globalThis.Bun === "function" || typeof globalThis.Bun === "object") {',
      '  console.error("driver is " + process.execPath + " and it has Bun");',
      "  process.exit(2);",
      "}",
      "const warns = [];",
      'setLogSink((event) => { if (event.level === "warn") warns.push(event.message); });',
      "const abort = new AbortController();",
      "let pid = 0;",
      "const client = createVariantClient({",
      "  cwd: process.env.PROJECT,",
      '  configPath: process.env.PROJECT + "/variants.yaml",',
      "  worktree: false,",
      "  miseBinPath: process.env.MISE,",
      "});",
      'const done = client.watch("main", {',
      '  outputMode: "tty",',
      "  signal: abort.signal,",
      "  log() {},",
      "  onStarted(result) { pid = result.processes[0]?.pid ?? 0; },",
      "});",
      'const logPath = process.env.PROJECT + "/.cache/variant/watch.log";',
      "let seen = false;",
      "for (let i = 0; i < 80; i++) {",
      "  try {",
      '    const text = readFileSync(logPath, "utf8");',
      '    if (text.includes("[fe] tty") || text.includes("[fe] pipe")) { seen = true; break; }',
      "  } catch {}",
      "  await delay(100);",
      "}",
      "let alive = false;",
      "try { process.kill(pid, 0); alive = true; } catch {}",
      'console.log("ALIVE " + alive);',
      'console.log("WARNS " + JSON.stringify(warns));',
      "abort.abort();",
      "await done;",
      'if (!seen) { console.error("watch log never showed [fe]"); process.exitCode = 1; }',
      "",
    ].join("\n"),
  );
  const mise = join(bin, "mise");
  writeExecutable(
    mise,
    [
      "#!/bin/sh",
      'printf "%s\\n" "$*" >> "$CALLS"',
      '[ "$1" = "-C" ] && exit 0',
      'relay=""',
      'prev=""',
      'for arg in "$@"; do',
      '  [ "$arg" = "--internal-pty" ] && relay="$prev"',
      '  prev="$arg"',
      "done",
      'if [ -n "$relay" ]; then exec "$REAL_BUN" "$relay" --internal-pty; fi',
      'case "$*" in',
      '  *bun@latest*) exit "$MISE_LATEST" ;;',
      "esac",
      'exit "$MISE_PROJECT"',
      "",
    ].join("\n"),
  );
  writeExecutable(
    join(bin, "bun"),
    [
      "#!/bin/sh",
      'printf "%s\\n" "bun $*" >> "$CALLS"',
      '[ "$2" = "--internal-pty" ] && exec "$REAL_BUN" "$@"',
      'exit "$BUN_PROBE"',
      "",
    ].join("\n"),
  );
  if (probe.script) {
    writeExecutable(
      join(bin, "script"),
      ["#!/bin/sh", 'printf "%s\\n" "script $*" >> "$CALLS"', 'exec /usr/bin/script "$@"', ""].join("\n"),
    );
  }
  if (!probe.script) {
    // AIDEV-NOTE: Ubuntu ships `script` in `/bin`. A PATH of `bin:/bin` would still allocate a terminal.
    symlinkSync("/bin/sh", join(bin, "sh"));
  }
  const path = probe.script ? `${bin}:${process.env.PATH ?? ""}` : bin;
  try {
    const proc = Bun.spawn([hostNode, join(directory, "drive.mjs")], {
      stdout: "pipe",
      stderr: "pipe",
      env: {
        ...process.env,
        PATH: path,
        REAL_BUN: process.execPath,
        CALLS: calls,
        MISE_PROJECT: String(probe.project),
        MISE_LATEST: String(probe.latest),
        BUN_PROBE: String(probe.pathBun),
        API: entries.index,
        PROJECT: directory,
        MISE: mise,
        VARIANT_WORKTREE: "0",
      },
    });
    const [exitCode, stdout, stderr] = await Promise.all([
      proc.exited,
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
    ]);
    let log = "";
    try {
      log = readFileSync(join(directory, ".cache/variant/watch.log"), "utf8");
    } catch {
      throw new Error(`no watch log\nexit ${exitCode}\nstdout:\n${stdout}\nstderr:\n${stderr}`);
    }
    return { stdout, stderr, log, calls: readFileSync(calls, "utf8"), exitCode };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
};

describe("tty allocators on Node", () => {
  it("uses mise exec -- bun and skips later allocators", async () => {
    const result = await watchTtyOnNode({ project: 0, latest: 0, pathBun: 0, script: true });
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("[fe] tty");
    expect(result.log).toContain("[fe] tty");
    expect(result.log).toContain("\u001b[32mgreen");
    expect(result.calls).toContain("--internal-pty");
    expect(result.calls).not.toContain("bun@latest");
    expect(result.calls.split("\n").some((line) => line.startsWith("bun "))).toBe(false);
    expect(result.calls.split("\n").some((line) => line.startsWith("script "))).toBe(false);
  }, 20000);

  it("uses mise exec bun@latest when the project bun fails", async () => {
    const result = await watchTtyOnNode({ project: 1, latest: 0, pathBun: 0, script: true });
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("[fe] tty");
    expect(result.calls).toContain("bun@latest");
    expect(result.calls).toContain("--internal-pty");
    expect(result.calls.split("\n").some((line) => line.startsWith("bun "))).toBe(false);
    expect(result.calls.split("\n").some((line) => line.startsWith("script "))).toBe(false);
  }, 20000);

  it("uses bun on PATH when both mise probes fail", async () => {
    const result = await watchTtyOnNode({ project: 1, latest: 1, pathBun: 0, script: true });
    const lines = result.calls.split("\n");
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("[fe] tty");
    expect(lines.some((line) => line.startsWith("bun ") && line.includes("--internal-pty"))).toBe(true);
    expect(lines.some((line) => line.includes("--internal-pty") && !line.startsWith("bun "))).toBe(false);
    expect(lines.some((line) => line.startsWith("script "))).toBe(false);
  }, 20000);

  it("uses script when mise and path bun fail", async () => {
    const result = await watchTtyOnNode({ project: 1, latest: 1, pathBun: 1, script: true });
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("[fe] tty");
    expect(result.log).toContain("[fe] tty");
    expect(result.log).toContain("\u001b[32mgreen");
    expect(result.stdout).not.toContain("\u0004");
    expect(result.log).not.toContain("\u0004");
    expect(result.log).not.toContain("stdin-end");
    expect(result.stdout).toContain("ALIVE true");
    expect(result.calls.split("\n").some((line) => line.startsWith("script "))).toBe(true);
    expect(result.calls.split("\n").some((line) => line.includes("--internal-pty"))).toBe(false);
  }, 20000);

  it("warns and uses pipes when no allocator works", async () => {
    const result = await watchTtyOnNode({ project: 1, latest: 1, pathBun: 1, script: false });
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("[fe] pipe");
    expect(result.stdout).toContain("ALIVE true");
    expect(result.stdout).toContain('WARNS ["fe terminal was not allocated"]');
    expect(result.log).toContain("fe terminal was not allocated");
    expect(result.log).not.toContain("mode=tty");
  }, 20000);
});
