import { afterEach, describe, expect, it } from "bun:test";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { join } from "node:path";
import { loadConfig, readRuntime } from "variant-config";
import { stringify as stringifyYaml } from "yaml";
import { isProcessAlive } from "../runtime-state.js";
import { type EngineStub, installEngineStub } from "../test/engine-stub.js";
import type { DatabaseAdapter, WatchOptions, WatchResult } from "../types.js";
import { relayModulePath, relaySpawnArgs } from "../watch-relay.js";
import { downVariant } from "./down.js";
import type { OperationContext } from "./types.js";
import { upVariant } from "./up.js";
import { watchVariant } from "./watch.js";

const originalPath = process.env.PATH;
const killAtEnd: number[] = [];
const servers: Server[] = [];
afterEach(() => {
  process.env.PATH = originalPath;
  for (const pid of killAtEnd.splice(0)) {
    try {
      process.kill(-pid, "SIGKILL");
    } catch {
      // already gone
    }
  }
  for (const server of servers.splice(0)) {
    server.close();
    server.closeAllConnections();
  }
});

const sleep = (ms: number): Promise<void> => new Promise((done) => setTimeout(done, ms));
const until = async (condition: () => boolean, ms = 10000): Promise<void> => {
  for (const deadline = Date.now() + ms; !condition(); await sleep(25)) {
    if (Date.now() > deadline) {
      throw new Error("condition not met in time");
    }
  }
};
const untilDead = (pid: number): Promise<void> => until(() => !isProcessAlive(pid));

/** What every watched process runs: it records itself, then idles, or exits after `DIE_AFTER` milliseconds. */
const WATCH_SCRIPT = `
import { appendFileSync, existsSync, writeFileSync } from "node:fs";
const who = process.env.WHO ?? "variant";
appendFileSync(process.env.ORDER_LOG ?? "order.log", who + " " + Date.now() + "\\n");
if (process.env.PRINT) {
  console.log("out " + who);
  console.error("err " + who);
}
if (process.env.STDOUT_LINE) console.log(process.env.STDOUT_LINE);
if (process.env.STDERR_LINE) console.error(process.env.STDERR_LINE);
if (process.env.WAIT_FILE) {
  const deadline = Date.now() + 10000;
  const pause = new Int32Array(new SharedArrayBuffer(4));
  while (!existsSync(process.env.WAIT_FILE)) {
    if (Date.now() > deadline) process.exit(2);
    Atomics.wait(pause, 0, 0, 30);
  }
  console.log("ready");
}
if (process.env.PARTIAL_STDOUT) process.stdout.write(process.env.PARTIAL_STDOUT + "\\r");
writeFileSync("started-" + who + ".txt", String(process.pid));
if (process.env.PARTIAL_STDOUT) process.exit(0);
setInterval(() => {}, 1000);
if (process.env.DIE_AFTER) setTimeout(() => process.exit(3), Number(process.env.DIE_AFTER));
`;

const lines = (...entries: string[]): string => `${entries.join("\n")}\n`;

const watcher = (who: string, extra = ""): string =>
  `{ kind: ${who === "be" ? "nestjs" : "vite"}, dir: ${who}, watch: "${process.execPath} ../watch.js", env: { overrides: { WHO: ${who}, ORDER_LOG: "\${worktree}/order.log" } }${extra} }`;

/** `watcher`, with a process that also prints one line to stdout and one to stderr. */
const printingWatcher = (who: string): string => watcher(who).replace("ORDER_LOG:", "PRINT: '1', ORDER_LOG:");

const BASE = lines(
  "db:",
  "  dialect: sqlite",
  "variant:",
  "  supervise: { startDelaySeconds: 0, readyTimeoutSeconds: 3, checkoutPollSeconds: 0 }",
  "  watches:",
  `    be: ${watcher("be")}`,
  `    fe: ${watcher("fe", ", url: 'http://${slug}.vw.localhost:${port}'")}`,
);

interface Project {
  directory: string;
  engine: EngineStub;
  database: string[];
  context: OperationContext;
  messages: string[];
  opened: string[];
  watch: (options?: WatchOptions, slug?: string) => Promise<WatchResult>;
  /** An attached watch that ends when `stop()` is called. */
  attach: (options?: WatchOptions) => { done: Promise<WatchResult>; stop: () => void };
  localFile: string;
  runtime: () => {
    createdAt?: string;
    watches: Record<string, { port?: number; pid?: number; url?: string; startedAt?: string }>;
    log?: string;
  } & Record<string, unknown>;
  /** The pid of a started watch, once it has written its marker. */
  started: (who: string) => Promise<number>;
}

const withProject = async (
  run: (project: Project) => Promise<void>,
  yaml: string = BASE,
  files: Record<string, string> = {},
  env: NodeJS.ProcessEnv = {},
): Promise<void> => {
  const directory = realpathSync(mkdtempSync(join("/tmp", "variant-watch-")));
  try {
    for (const folder of ["fe", "be"]) {
      mkdirSync(join(directory, folder));
    }
    writeFileSync(join(directory, "watch.js"), WATCH_SCRIPT);
    for (const [path, content] of Object.entries(files)) {
      writeFileSync(join(directory, path), content);
    }
    writeFileSync(join(directory, "variants.yaml"), yaml);
    const engine = installEngineStub(directory);
    process.env.PATH = `${engine.bin}:${originalPath}`;
    const database: string[] = [];
    const adapter: DatabaseAdapter = {
      dialect: "sqlite",
      create: async (slug) => {
        database.push(`create ${slug}`);
        return slug;
      },
      createSchema: async (name) => {
        database.push(`schema ${name}`);
      },
      matchingSchemas: async (prefix) => {
        database.push(`match ${prefix}`);
        return [];
      },
      dropSchema: async (name) => {
        database.push(`drop ${name}`);
      },
      destroy: async (slug) => {
        database.push(`destroy ${slug}`);
        return true;
      },
      list: async () => [],
      target: (slug) => `v_${slug}`,
      close: async () => {},
    };
    const stateDir = join(directory, ".cache", "variants");
    mkdirSync(stateDir, { recursive: true });
    const context: OperationContext = {
      config: loadConfig({ cwd: directory, env }),
      variantRoot: directory,
      stateDir,
      cwd: directory,
      useWorktree: false,
      adapter,
    };
    const messages: string[] = [];
    const opened: string[] = [];
    const defaults: WatchOptions = {
      log: (line) => messages.push(line),
      opener: (url) => {
        opened.push(url);
      },
    };
    const localFile = join(directory, "variants.local.yaml");
    const watch = async (options: WatchOptions = {}, slug = "demo"): Promise<WatchResult> => {
      const result = await watchVariant(context, slug, { ...defaults, ...options });
      killAtEnd.push(...result.processes.map(({ pid }) => pid));
      return result;
    };
    await run({
      directory,
      engine,
      database,
      context,
      messages,
      opened,
      watch,
      attach: (options = {}) => {
        const abort = new AbortController();
        const done = watch({ ...options, signal: abort.signal });
        return { done, stop: () => abort.abort() };
      },
      localFile,
      runtime: () => readRuntime(directory) as never,
      started: async (who) => {
        const marker = join(directory, who, `started-${who}.txt`);
        await until(() => existsSync(marker) && readFileSync(marker, "utf8") !== "");
        const pid = Number(readFileSync(marker, "utf8"));
        killAtEnd.push(pid);
        return pid;
      },
    });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
};

/** An HTTP server whose `/health` answers 503 until `healthyAfterMs` have passed. */
const healthServer = async (healthyAfterMs: number): Promise<{ port: number; healthyAt: () => number }> => {
  const born = Date.now();
  let healthyAt = 0;
  const server = createServer((request, response) => {
    const healthy = request.url === "/health" && Date.now() - born >= healthyAfterMs;
    if (healthy && healthyAt === 0) {
      healthyAt = Date.now();
    }
    response.statusCode = healthy ? 200 : 503;
    response.end();
  });
  servers.push(server);
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  return { port: (server.address() as { port: number }).port, healthyAt: () => healthyAt };
};

const orderLog = (directory: string): { who: string; at: number }[] =>
  readFileSync(join(directory, "order.log"), "utf8")
    .split("\n")
    .filter((line) => line !== "")
    .map((line) => ({ who: line.split(" ")[0] as string, at: Number(line.split(" ")[1]) }));

describe("watch starts host processes", () => {
  it("starts every watch with a watch command in order, waits between them and records the pids", () =>
    withProject(
      async ({ watch, directory, runtime, started, messages }) => {
        const result = await watch({ detach: true });
        const be = await started("be");
        const fe = await started("fe");

        expect(result.exitCode).toBe(0);
        expect(result.processes.map(({ key }) => key)).toEqual(["be", "fe"]);
        expect(runtime().mode).toBe("watch");
        expect(runtime().watches.be?.pid).toBe(result.processes[0]?.pid);
        expect(runtime().watches.fe?.pid).toBe(result.processes[1]?.pid);
        expect(runtime().watches.fe?.startedAt).toMatch(/^\d{4}-\d{2}-\d{2}_\d{2}:\d{2}:\d{2}$/);
        expect(isProcessAlive(be) && isProcessAlive(fe)).toBe(true);
        const [first, second] = orderLog(directory);
        expect([first?.who, second?.who]).toEqual(["be", "fe"]);
        expect((second?.at as number) - (first?.at as number)).toBeGreaterThanOrEqual(900);
        expect(messages).toContain(`[be] ${process.execPath} ../watch.js`);
      },
      BASE.replace("startDelaySeconds: 0", "startDelaySeconds: 1"),
    ));

  it("writes the start time and keeps createdAt", () =>
    withProject(
      async ({ watch, runtime, context, started }) => {
        context.now = () => new Date(2026, 10, 4, 12, 30, 0);

        await watch({ detach: true });
        await started("fe");

        expect(runtime().createdAt).toBe("2026-01-02_03:04:05");
        expect(runtime().watches.fe?.startedAt).toBe("2026-11-04_12:30:00");
      },
      undefined,
      { "variants.local.yaml": "runtime:\n  createdAt: 2026-01-02_03:04:05\n" },
    ));

  it("does not start a watch without a watch command", () =>
    withProject(
      async ({ watch, started, directory }) => {
        const result = await watch({ detach: true });
        await started("fe");

        expect(result.processes.map(({ key }) => key)).toEqual(["fe"]);
        expect(existsSync(join(directory, "be", "started-be.txt"))).toBe(false);
      },
      BASE.replace(/ {4}be: .*\n/, "    be: { kind: nestjs, dir: be }\n"),
    ));

  it("terminates the processes of an earlier run before starting new ones", () =>
    withProject(async ({ watch, started }) => {
      const first = await watch({ detach: true });
      await started("be");

      const second = await watch({ detach: true });

      await untilDead(first.processes[0]?.pid as number);
      expect(second.processes[0]?.pid).not.toBe(first.processes[0]?.pid);
      expect(isProcessAlive(second.processes[0]?.pid as number)).toBe(true);
    }));

  it("stops the containers of the variant and keeps the database target", () =>
    withProject(
      async ({ watch, engine, database }) => {
        engine.seed({ containers: ["v-be-demo"], networks: ["v-net-demo"] });

        await watch({ detach: true });

        expect(engine.state()).toEqual({ containers: [], networks: [] });
        expect(database).toEqual(["create demo"]);
      },
      BASE.replace(
        "kind: nestjs, dir: be,",
        "kind: nestjs, dir: be, container: { dockerfile: be/Dockerfile, internalPort: 3000 },",
      ),
    ));

  it("fails naming the directory when a process cannot be started and stops the ones already running", () =>
    withProject(
      async ({ watch, directory }) => {
        const failure = await watch({ detach: true }).catch((error: Error) => error);

        expect((failure as Error).message).toContain(join(directory, "gone"));
        await sleep(200);
        const marker = join(directory, "be", "started-be.txt");
        if (existsSync(marker)) {
          await untilDead(Number(readFileSync(marker, "utf8")));
        }
      },
      BASE.replace("    fe: { kind: vite, dir: fe,", "    fe: { kind: vite, dir: gone,"),
    ));

  it("keeps the variant-ui entry that the server recorded in the runtime state of main", () =>
    withProject(async ({ watch, localFile, runtime }) => {
      const ui = { port: 62100, pid: process.pid, url: "http://ui.vw.localhost:62100" };
      writeFileSync(localFile, stringifyYaml({ runtime: { watches: { "variant-ui": ui } } }));

      await watch({ detach: true }, "main");

      expect(runtime().watches["variant-ui"]).toEqual(ui);
      expect(Object.keys(runtime().watches).sort()).toEqual(["be", "fe", "variant-ui"]);
    }));

  it("never touches the database target of main", () =>
    withProject(async ({ watch, database }) => {
      await watch({ detach: true }, "main");

      expect(database).toEqual([]);
    }));
});

describe("watch supervision", () => {
  it("ends with 130 on abort, terminates the processes and removes the pids from the runtime state", () =>
    withProject(async ({ attach, started, runtime }) => {
      const { done, stop } = attach();
      const be = await started("be");
      const fe = await started("fe");
      await until(() => runtime().watches.fe?.pid !== undefined);

      stop();
      const result = await done;

      expect(result.exitCode).toBe(130);
      await untilDead(be);
      await untilDead(fe);
      expect(runtime().watches.be?.pid).toBeUndefined();
      expect(runtime().watches.fe?.pid).toBeUndefined();
    }));

  it("ends with 130 on SIGINT", () =>
    withProject(async ({ attach, started }) => {
      const { done } = attach();
      const be = await started("be");
      await started("fe");

      process.emit("SIGINT");
      const result = await done;

      expect(result.exitCode).toBe(130);
      await untilDead(be);
    }));

  it("ends the other watches with 1 when one dies", () =>
    withProject(
      async ({ attach, started }) => {
        const { done } = attach();
        const fe = await started("fe");

        const result = await done;

        expect(result.exitCode).toBe(1);
        await untilDead(fe);
      },
      BASE.replace("overrides: { WHO: be,", "overrides: { DIE_AFTER: '600', WHO: be,"),
    ));

  it("drops the database target and ends with 1 when the worktree disappears", () =>
    withProject(
      async ({ attach, started, directory, database }) => {
        const { done } = attach();
        const fe = await started("fe");
        await started("be");

        rmSync(directory, { recursive: true, force: true });
        const result = await done;

        expect(result.exitCode).toBe(1);
        expect(database).toContain("destroy demo");
        await untilDead(fe);
      },
      BASE.replace("checkoutPollSeconds: 0", "checkoutPollSeconds: 1"),
    ));

  it("does not check the worktree when checkoutPollSeconds is 0", () =>
    withProject(async ({ attach, started, directory, database }) => {
      const { done, stop } = attach();
      await started("fe");
      await started("be");
      let ended = false;
      void done.then(() => {
        ended = true;
      });

      rmSync(directory, { recursive: true, force: true });
      await sleep(1500);

      expect(ended).toBe(false);
      expect(database).not.toContain("destroy demo");
      stop();
      expect((await done).exitCode).toBe(130);
    }));

  it("returns a detached watch with its processes still running", () =>
    withProject(async ({ watch, started }) => {
      const result = await watch({ detach: true });
      const be = await started("be");

      expect(result.exitCode).toBe(0);
      await sleep(300);
      expect(isProcessAlive(be)).toBe(true);
    }));
});

describe("watch readiness and opening", () => {
  const withHealth = (
    healthyAfterMs: number,
    run: (project: Project, health: { port: number; healthyAt: () => number }) => Promise<void>,
    yaml: string = BASE,
    env: NodeJS.ProcessEnv = {},
  ): Promise<void> =>
    healthServer(healthyAfterMs).then((health) =>
      withProject(
        (project) => run(project, health),
        yaml.replace("kind: nestjs, dir: be,", "kind: nestjs, dir: be, ready: /health,"),
        {
          "variants.local.yaml": `runtime:\n  watches:\n    be: { port: ${health.port} }\n    fe: { port: 62060 }\n`,
        },
        env,
      ),
    );

  it("opens the URLs after the watch with ready answers", () =>
    withHealth(1500, async ({ attach, opened, messages }, health) => {
      const { done, stop } = attach();

      await sleep(700);
      expect(opened).toEqual([]);
      await until(() => opened.length > 0);

      expect(opened).toEqual(["http://demo.vw.localhost:62060"]);
      expect(Date.now()).toBeGreaterThanOrEqual(health.healthyAt());
      expect(messages).toContain("fe: http://demo.vw.localhost:62060");
      stop();
      await done;
    }));

  it("opens right away when no watch sets ready", () =>
    withProject(async ({ attach, opened }) => {
      const { done, stop } = attach();

      await until(() => opened.length > 0, 1500);

      expect(opened).toEqual([expect.stringMatching(/^http:\/\/demo\.vw\.localhost:\d+$/)]);
      stop();
      await done;
    }));

  it("warns after readyTimeoutSeconds, opens nothing and keeps the watches running", () =>
    withHealth(
      60_000,
      async ({ attach, opened, messages, started }) => {
        const { done, stop } = attach();
        const be = await started("be");

        await until(() => messages.some((line) => line.startsWith("Warning")), 4000);

        expect(opened).toEqual([]);
        expect(isProcessAlive(be)).toBe(true);
        stop();
        await done;
      },
      BASE.replace("readyTimeoutSeconds: 3", "readyTimeoutSeconds: 1"),
    ));

  it("prints the URL but does not open it when variant.open is false", () =>
    withProject(
      async ({ attach, opened, messages }) => {
        const { done, stop } = attach();

        await until(() => messages.some((line) => line.startsWith("fe: ")));

        expect(opened).toEqual([]);
        stop();
        await done;
      },
      BASE.replace("variant:\n", "variant:\n  open: false\n"),
    ));

  it("does not open URLs when VARIANT_OPEN is 0", () =>
    withProject(
      async ({ attach, opened, messages }) => {
        const { done, stop } = attach();

        await until(() => messages.some((line) => line.startsWith("fe: ")));

        expect(opened).toEqual([]);
        stop();
        await done;
      },
      BASE,
      {},
      { VARIANT_OPEN: "0" },
    ));

  it("reports an opener that fails without failing the command", () =>
    withProject(async ({ attach, messages }) => {
      const { done, stop } = attach({
        opener: () => {
          throw new Error("no browser");
        },
      });

      await until(() => messages.some((line) => line.startsWith("Could not open")));

      stop();
      expect((await done).exitCode).toBe(130);
    }));
});

/** Bytes written through a stream, including lines the watch relay prefixes onto the console. */
const captureWrite = (stream: NodeJS.WriteStream): { text: () => string; stop: () => void } => {
  const chunks: string[] = [];
  const original = stream.write;
  stream.write = ((chunk: string | Uint8Array, ...args: unknown[]) => {
    chunks.push(typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8"));
    return original.call(stream, chunk, ...(args as []));
  }) as typeof stream.write;
  return {
    text: () => chunks.join(""),
    stop: () => {
      stream.write = original;
    },
  };
};

describe("watch output log", () => {
  const logIn = (directory: string): string => join(directory, ".cache", "variant", "watch.log");
  const withLine = (
    who: string,
    name: "STDOUT_LINE" | "STDERR_LINE" | "PARTIAL_STDOUT" | "WAIT_FILE",
    value: string,
  ): string =>
    BASE.replace(
      `    ${who}: ${watcher(who, who === "fe" ? ", url: 'http://${slug}.vw.localhost:${port}'" : "")}`,
      `    ${who}: ${watcher(who, who === "fe" ? ", url: 'http://${slug}.vw.localhost:${port}'" : "").replace("ORDER_LOG:", `${name}: '${value}', ORDER_LOG:`)}`,
    );

  it("prefixes attached stdout and appends it to the log while the process runs", () =>
    withProject(
      async ({ attach, directory, started }) => {
        const stdout = captureWrite(process.stdout);
        const { done, stop } = attach();
        try {
          await started("fe");
          const log = logIn(directory);
          await until(
            () =>
              stdout.text().includes("[fe] ready") &&
              existsSync(log) &&
              readFileSync(log, "utf8").includes("[fe] ready"),
            1500,
          ).catch(() => {});
          expect(stdout.text()).toContain("[fe] ready\n");
          expect(existsSync(log) ? readFileSync(log, "utf8") : "").toContain("[fe] ready\n");
          expect(isProcessAlive(await started("fe"))).toBe(true);
        } finally {
          stdout.stop();
          stop();
          await done;
        }
      },
      withLine("fe", "STDOUT_LINE", "ready"),
    ));

  it("prefixes attached stderr onto stderr and the log, not stdout", () =>
    withProject(
      async ({ attach, directory, started }) => {
        const stdout = captureWrite(process.stdout);
        const stderr = captureWrite(process.stderr);
        const { done, stop } = attach();
        try {
          await started("fe");
          const log = logIn(directory);
          await until(
            () =>
              stderr.text().includes("[fe] oops") && existsSync(log) && readFileSync(log, "utf8").includes("[fe] oops"),
            1500,
          ).catch(() => {});
          expect(stderr.text()).toContain("[fe] oops\n");
          expect(stdout.text()).not.toContain("oops");
          expect(readFileSync(log, "utf8")).toContain("[fe] oops\n");
        } finally {
          stdout.stop();
          stderr.stop();
          stop();
          await done;
        }
      },
      withLine("fe", "STDERR_LINE", "oops"),
    ));

  it("prefixes a trailing partial stdout line when the stream ends", () =>
    withProject(
      async ({ attach, directory }) => {
        const stdout = captureWrite(process.stdout);
        const { done, stop } = attach();
        try {
          const log = logIn(directory);
          await until(
            () =>
              stdout.text().includes("[fe] partial") &&
              existsSync(log) &&
              readFileSync(log, "utf8").includes("[fe] partial"),
            1500,
          ).catch(() => {});
          expect(stdout.text()).toContain("[fe] partial\n");
          expect(stdout.text()).not.toContain("[fe] partial\r");
          expect(readFileSync(log, "utf8")).toContain("[fe] partial\n");
        } finally {
          stdout.stop();
          stop();
          await done;
        }
      },
      withLine("fe", "PARTIAL_STDOUT", "partial"),
    ));

  it("truncates the log on the next run, records its absolute path, and writes each command first", () =>
    withProject(
      async ({ attach, directory, runtime, started }) => {
        const log = logIn(directory);
        mkdirSync(join(directory, ".cache", "variant"), { recursive: true });
        writeFileSync(log, "old run\n");
        const first = attach();
        await started("fe");
        await until(() => readFileSync(log, "utf8").includes(`[fe] ${process.execPath} ../watch.js`), 1500);
        first.stop();
        await first.done;
        expect(readFileSync(log, "utf8")).not.toContain("old run");

        writeFileSync(log, "old run\n");
        for (const who of ["be", "fe"]) {
          rmSync(join(directory, who, `started-${who}.txt`), { force: true });
        }
        const second = attach();
        try {
          await started("be");
          await started("fe");
          await until(() => {
            const text = readFileSync(log, "utf8");
            return text.includes("[be] out be") && text.includes("[fe] out fe") && !text.includes("old run");
          }, 1500).catch(() => {});
          const text = readFileSync(log, "utf8");
          const beBanner = `[be] ${process.execPath} ../watch.js`;
          const feBanner = `[fe] ${process.execPath} ../watch.js`;
          expect(text).not.toContain("old run");
          expect(text.indexOf(beBanner)).toBeGreaterThanOrEqual(0);
          expect(text.indexOf(beBanner)).toBeLessThan(text.indexOf("[be] out be"));
          expect(text.indexOf(feBanner)).toBeLessThan(text.indexOf("[fe] out fe"));
          expect(runtime().log).toBe(log);
        } finally {
          second.stop();
          await second.done;
        }
      },
      BASE.replace(`    be: ${watcher("be")}`, `    be: ${printingWatcher("be")}`).replace(
        `    fe: ${watcher("fe", ", url: 'http://${slug}.vw.localhost:${port}'")}`,
        `    fe: ${printingWatcher("fe")}`,
      ),
    ));

  it("drops the recorded log on down and keeps the file", () =>
    withProject(async ({ attach, directory, context, started, runtime }) => {
      const { done, stop } = attach();
      try {
        await started("fe");
        const log = logIn(directory);
        await until(() => runtime().log === log && existsSync(log), 1500);
        await downVariant(context, "demo");
        expect(runtime().log).toBeUndefined();
        expect(readFileSync(log, "utf8").length).toBeGreaterThan(0);
      } finally {
        stop();
        await done;
      }
    }));

  it("prefixes detached stdout into the log and leaves it off the caller's stdout", () =>
    withProject(
      async ({ watch, directory, runtime }) => {
        const stdout = captureWrite(process.stdout);
        try {
          const result = await watch({ detach: true });
          const log = logIn(directory);
          await until(() => existsSync(log) && readFileSync(log, "utf8").includes("[fe] ready"), 1500).catch(() => {});
          expect(existsSync(log) ? readFileSync(log, "utf8") : "").toContain("[fe] ready\n");
          expect(stdout.text()).not.toContain("[fe] ready");
          expect(runtime().log).toBe(log);
          expect(isProcessAlive(result.processes.find((process) => process.key === "fe")?.pid as number)).toBe(true);
        } finally {
          stdout.stop();
        }
      },
      withLine("fe", "STDOUT_LINE", "ready"),
    ));

  it("appends detached output that arrives after the call returns", () =>
    withProject(
      async ({ watch, directory }) => {
        const stdout = captureWrite(process.stdout);
        try {
          await watch({ detach: true });
          const log = logIn(directory);
          await until(() => existsSync(log) && readFileSync(log, "utf8").includes("[fe] "), 1500);
          expect(readFileSync(log, "utf8")).not.toContain("[fe] ready");
          writeFileSync(join(directory, "go.txt"), "go\n");
          await until(() => readFileSync(log, "utf8").includes("[fe] ready"), 1500);
          expect(stdout.text()).not.toContain("[fe] ready");
        } finally {
          stdout.stop();
        }
      },
      withLine("fe", "WAIT_FILE", "../go.txt"),
    ));

  it("spawns the on-disk relay module for a detached watch", () =>
    withProject(async ({ watch, started }) => {
      await watch({ detach: true });
      const commandOf = (pid: number): string =>
        execFileSync("ps", ["-ww", "-o", "command=", "-p", String(pid)], { encoding: "utf8" }).trim();
      const parentOf = (pid: number): number =>
        Number(execFileSync("ps", ["-o", "ppid=", "-p", String(pid)], { encoding: "utf8" }).trim());
      let current = await started("fe");
      let command = "";
      for (let hop = 0; hop < 5 && !command.includes("watch-relay.ts"); hop += 1) {
        current = parentOf(current);
        command = commandOf(current);
      }
      expect(command).toContain("watch-relay.ts");
    }));

  it("selects --internal-watch-relay when the program is a compiled executable", () => {
    expect(relaySpawnArgs("/usr/bin/variant", "/$bunfs/root/cli", "/no/such/watch-relay.ts")).toEqual([
      "/usr/bin/variant",
      "--internal-watch-relay",
    ]);
    expect(relaySpawnArgs(process.execPath, process.argv[1], relayModulePath())).toEqual([
      process.execPath,
      relayModulePath(),
    ]);
  });

  it("writes no watch log for up", () =>
    withProject(async ({ directory, context, runtime }) => {
      await upVariant(context, "demo", { log: () => {}, opener: () => {} });
      expect(existsSync(logIn(directory))).toBe(false);
      expect(runtime().log).toBeUndefined();
    }));
});

describe("detached watch log", () => {
  const PRINTING = BASE.replace(`    be: ${watcher("be")}`, `    be: ${printingWatcher("be")}`).replace(
    `    fe: ${watcher("fe", ", url: 'http://${slug}.vw.localhost:${port}'")}`,
    `    fe: ${printingWatcher("fe")}`,
  );
  const logIn = (directory: string): string => join(directory, ".cache", "variant", "watch.log");
  const untilLogHas = (directory: string, ...needles: string[]): Promise<void> =>
    until(
      () =>
        existsSync(logIn(directory)) &&
        needles.every((needle) => readFileSync(logIn(directory), "utf8").includes(needle)),
    );

  it("writes the output of every process to one file while they run and records its path", () =>
    withProject(async ({ watch, directory, runtime }) => {
      const result = await watch({ detach: true });

      await untilLogHas(directory, "out be", "err be", "out fe", "err fe");
      const log = readFileSync(logIn(directory), "utf8");
      for (const { key, command } of result.processes) {
        expect(log).toContain(`[${key}] ${command}`);
      }
      expect(runtime().log).toBe(logIn(directory));
      expect(isProcessAlive(result.processes[0]?.pid as number)).toBe(true);
    }, PRINTING));

  it("starts the file over when the watch runs again", () =>
    withProject(async ({ watch, directory }) => {
      mkdirSync(join(directory, ".cache", "variant"), { recursive: true });
      writeFileSync(logIn(directory), "old run\n");
      await watch({ detach: true });
      await untilLogHas(directory, "out be");

      expect(readFileSync(logIn(directory), "utf8")).not.toContain("old run");
    }, PRINTING));

  it("leaves no log file or runtime log behind when a process cannot start", () =>
    withProject(
      async ({ watch, directory, localFile }) => {
        const failure = await watch({ detach: true }).catch((error: Error) => error);

        expect(failure).toBeInstanceOf(Error);
        expect((failure as Error).message).toContain("Could not start be");
        expect(existsSync(logIn(directory))).toBe(false);
        expect(existsSync(localFile)).toBe(false);
      },
      PRINTING.replace("dir: be", "dir: gone"),
    ));
});
