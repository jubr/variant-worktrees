import { afterEach, describe, expect, it } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { join } from "node:path";
import { loadConfig } from "variant-config";
import { parse as parseYaml } from "yaml";
import type { OperationContext } from "../src/operations/types.js";
import { watchVariant } from "../src/operations/watch.js";
import { isProcessAlive } from "../src/runtime-state.js";
import type { DatabaseAdapter, WatchOptions, WatchResult } from "../src/types.js";
import { type EngineStub, installEngineStub } from "./support/engine-stub.js";

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
import { appendFileSync, writeFileSync } from "node:fs";
const who = process.env.WHO ?? "variant";
appendFileSync(process.env.ORDER_LOG ?? "order.log", who + " " + Date.now() + "\\n");
writeFileSync("started-" + who + ".txt", String(process.pid));
setInterval(() => {}, 1000);
if (process.env.DIE_AFTER) setTimeout(() => process.exit(3), Number(process.env.DIE_AFTER));
`;

const lines = (...entries: string[]): string => `${entries.join("\n")}\n`;

const watcher = (who: string, extra = ""): string =>
  `{ kind: ${who === "be" ? "nestjs" : "vite"}, dir: ${who}, watch: "${process.execPath} ../watch.js", env: { WHO: ${who}, ORDER_LOG: "{{worktree}}/order.log" }${extra} }`;

const BASE = lines(
  "db:",
  "  dialect: sqlite",
  "variant:",
  "  supervise: { startDelaySeconds: 0, readyTimeoutSeconds: 3, checkoutPollSeconds: 0 }",
  "  instances:",
  `    be: ${watcher("be")}`,
  `    fe: ${watcher("fe", ", open: 'http://{{slug}}.vw.localhost:{{port}}'")}`,
);

interface Project {
  directory: string;
  engine: EngineStub;
  database: string[];
  messages: string[];
  opened: string[];
  watch: (options?: WatchOptions, slug?: string) => Promise<WatchResult>;
  /** An attached watch that ends when `stop()` is called. */
  attach: (options?: WatchOptions) => { done: Promise<WatchResult>; stop: () => void };
  localFile: string;
  runtime: () => { instances: Record<string, { port?: number; pid?: number; url?: string }> } & Record<string, unknown>;
  /** The pid of a started instance, once it has written its marker. */
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
      messages,
      opened,
      watch,
      attach: (options = {}) => {
        const abort = new AbortController();
        const done = watch({ ...options, signal: abort.signal });
        return { done, stop: () => abort.abort() };
      },
      localFile,
      runtime: () => (parseYaml(readFileSync(localFile, "utf8")) as { runtime: never }).runtime,
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
  it("starts every instance with a watch command in order, waits between them and records the pids", () =>
    withProject(
      async ({ watch, directory, runtime, started, messages }) => {
        const result = await watch({ detach: true });
        const be = await started("be");
        const fe = await started("fe");

        expect(result.exitCode).toBe(0);
        expect(result.processes.map(({ key }) => key)).toEqual(["be", "fe"]);
        expect(runtime().mode).toBe("watch");
        expect(runtime().instances.be?.pid).toBe(result.processes[0]?.pid);
        expect(runtime().instances.fe?.pid).toBe(result.processes[1]?.pid);
        expect(isProcessAlive(be) && isProcessAlive(fe)).toBe(true);
        const [first, second] = orderLog(directory);
        expect([first?.who, second?.who]).toEqual(["be", "fe"]);
        expect((second?.at as number) - (first?.at as number)).toBeGreaterThanOrEqual(900);
        expect(messages).toContain(`[be] ${process.execPath} ../watch.js`);
      },
      BASE.replace("startDelaySeconds: 0", "startDelaySeconds: 1"),
    ));

  it("does not start an instance without a watch command", () =>
    withProject(
      async ({ watch, started, directory }) => {
        const result = await watch({ detach: true });
        await started("fe");

        expect(result.processes.map(({ key }) => key)).toEqual(["fe"]);
        expect(existsSync(join(directory, "be", "started-be.txt"))).toBe(false);
      },
      BASE.replace(/ {4}be: .*\n/, "    be: { kind: nestjs, dir: be }\n"),
    ));

  it("runs variant.watch once in the worktree root when no instance has a command", () =>
    withProject(
      async ({ watch, directory, runtime }) => {
        const result = await watch({ detach: true });
        await until(() => existsSync(join(directory, "started-variant.txt")));

        expect(result.processes.map(({ key }) => key)).toEqual(["variant"]);
        expect(runtime().instances.variant?.pid).toBe(result.processes[0]?.pid);
      },
      lines(
        "db:",
        "  dialect: sqlite",
        "variant:",
        `  watch: "${process.execPath} watch.js"`,
        "  instances:",
        "    be: { kind: nestjs, dir: be }",
      ),
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
      BASE.replace("kind: nestjs, dir: be,", "kind: nestjs, dir: be, container: { image: app, port: 3000 },"),
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
      await until(() => runtime().instances.fe?.pid !== undefined);

      stop();
      const result = await done;

      expect(result.exitCode).toBe(130);
      await untilDead(be);
      await untilDead(fe);
      expect(runtime().instances.be?.pid).toBeUndefined();
      expect(runtime().instances.fe?.pid).toBeUndefined();
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

  it("ends the other instances with 1 when one dies", () =>
    withProject(
      async ({ attach, started }) => {
        const { done } = attach();
        const fe = await started("fe");

        const result = await done;

        expect(result.exitCode).toBe(1);
        await untilDead(fe);
      },
      BASE.replace("env: { WHO: be,", "env: { DIE_AFTER: '600', WHO: be,"),
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
          "variants.local.yaml": `runtime:\n  instances:\n    be: { port: ${health.port} }\n    fe: { port: 62060 }\n`,
        },
        env,
      ),
    );

  it("opens the URLs after the instance with ready answers", () =>
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

  it("opens right away when no instance sets ready", () =>
    withProject(async ({ attach, opened }) => {
      const { done, stop } = attach();

      await until(() => opened.length > 0, 1500);

      expect(opened).toEqual([expect.stringMatching(/^http:\/\/demo\.vw\.localhost:\d+$/)]);
      stop();
      await done;
    }));

  it("warns after readyTimeoutSeconds, opens nothing and keeps the instances running", () =>
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
