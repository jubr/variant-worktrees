import { Database } from "bun:sqlite";
import { afterEach, describe, expect, it } from "bun:test";
import { type ChildProcess, spawn } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { loadConfig } from "variant-config";
import { parse as parseYaml } from "yaml";
import { createClient } from "../src/index.js";
import { downVariant } from "../src/operations/down.js";
import type { OperationContext } from "../src/operations/types.js";
import { upVariant } from "../src/operations/up.js";
import { isProcessAlive } from "../src/runtime-state.js";
import type { DatabaseAdapter } from "../src/types.js";
import { type EngineStub, installEngineStub } from "./support/engine-stub.js";

const originalPath = process.env.PATH;
const saved: Record<string, string | undefined> = {};
const setEnv = (name: string, value: string | undefined): void => {
  if (!(name in saved)) {
    saved[name] = process.env[name];
  }
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
};
const spawned: ChildProcess[] = [];
afterEach(() => {
  process.env.PATH = originalPath;
  for (const [name, value] of Object.entries(saved)) {
    if (value === undefined) {
      delete process.env[name];
    } else {
      process.env[name] = value;
    }
    delete saved[name];
  }
  for (const child of spawned.splice(0)) {
    try {
      process.kill(-(child.pid as number), "SIGKILL");
    } catch {
      // already gone
    }
  }
});

const lines = (...entries: string[]): string => `${entries.join("\n")}\n`;

const FE_BE = lines(
  "db:",
  "  dialect: sqlite",
  "variant:",
  "  instances:",
  "    be:",
  "      kind: nestjs",
  "      dir: be",
  "      container: { dockerfile: be/Dockerfile, port: 3000, image: app }",
  "    fe:",
  "      kind: vite",
  "      dir: fe",
  "      open: http://{{slug}}.vw.localhost:{{port}}",
  "      container: { static: dist, proxy: { path: /api/, to: be } }",
  "  supervise: { startDelaySeconds: 0 }",
);

interface Project {
  directory: string;
  engine: EngineStub;
  /** The database adapter calls, as `create <slug>` and `destroy <slug>`. */
  database: string[];
  up: (slug?: string) => ReturnType<typeof upVariant>;
  context: OperationContext;
  localFile: string;
  runtime: () => Record<string, unknown>;
}

const withProject = async (
  run: (project: Project) => Promise<void>,
  yaml: string = FE_BE,
  files: Record<string, string> = {},
): Promise<void> => {
  const directory = realpathSync(mkdtempSync(join("/tmp", "variant-up-")));
  try {
    for (const folder of ["fe", "be"]) {
      mkdirSync(join(directory, folder));
    }
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
      config: loadConfig({ cwd: directory, env: {} }),
      variantRoot: directory,
      stateDir,
      cwd: directory,
      useWorktree: false,
      adapter,
    };
    const localFile = join(directory, "variants.local.yaml");
    await run({
      directory,
      engine,
      database,
      context,
      up: (slug = "demo") => upVariant(context, slug, { opener: async () => {}, log: () => {} }),
      localFile,
      runtime: () => (parseYaml(readFileSync(localFile, "utf8")) as { runtime: Record<string, unknown> }).runtime,
    });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
};

const runCall = (engine: EngineStub, name: string): string[] => {
  const call = engine.calls().find((entry) => entry[0] === "run" && entry.includes(name));
  if (!call) {
    throw new Error(`no run call for ${name}: ${JSON.stringify(engine.calls())}`);
  }
  return call;
};

/** The values given to a repeated flag, e.g. every `-e`. */
const flagValues = (call: string[], flag: string): string[] =>
  call.flatMap((word, index) => (word === flag ? [call[index + 1] as string] : []));

describe("up preparation", () => {
  it("recreates the database target of a variant", () =>
    withProject(async ({ up, database }) => {
      await up();

      expect(database.slice(0, 2)).toEqual(["destroy demo", "create demo"]);
    }));

  it("neither creates nor drops the target of main", () =>
    withProject(async ({ up, database }) => {
      await up("main");

      expect(database).toEqual([]);
    }));

  it("reuses the recorded port of an instance", () =>
    withProject(
      async ({ up, engine, runtime }) => {
        await up();

        expect(runCall(engine, "v-fe-demo")).toContain("0.0.0.0:62060:80");
        expect((runtime().instances as Record<string, { port: number }>).fe?.port).toBe(62060);
      },
      FE_BE,
      { "variants.local.yaml": "runtime:\n  instances:\n    fe: { port: 62060 }\n" },
    ));

  it("lets VARIANT_<KEY>_PORT win over the recorded port and records it", () =>
    withProject(
      async ({ up, engine, runtime }) => {
        setEnv("VARIANT_FE_PORT", "62070");

        await up();

        expect(runCall(engine, "v-fe-demo")).toContain("0.0.0.0:62070:80");
        expect((runtime().instances as Record<string, { port: number }>).fe?.port).toBe(62070);
      },
      FE_BE,
      { "variants.local.yaml": "runtime:\n  instances:\n    fe: { port: 62060 }\n" },
    ));

  it("fails naming both variables when two overrides give the same port", () =>
    withProject(async ({ up, engine }) => {
      setEnv("VARIANT_FE_PORT", "62070");
      setEnv("VARIANT_BE_PORT", "62070");

      const failure = await up().catch((error: Error) => error);

      expect((failure as Error).message).toContain("VARIANT_BE_PORT");
      expect((failure as Error).message).toContain("VARIANT_FE_PORT");
      expect(engine.calls()).toEqual([]);
    }));

  it("gives instances without a recorded port different free ports", () =>
    withProject(async ({ up, runtime }) => {
      const result = await up();

      const ports = Object.values(runtime().instances as Record<string, { port: number }>).map(({ port }) => port);
      expect(new Set(ports).size).toBe(2);
      expect(result.containers.map(({ port }) => port).sort()).toEqual([...ports].sort());
    }));

  it("recreates a real database file empty", () =>
    withProject(async ({ directory }) => {
      const client = createClient({
        config: loadConfig({ cwd: directory, env: {} }),
        cwd: directory,
        stateDir: join(directory, ".cache", "variants"),
        worktree: false,
      });
      const record = await client.create("demo");
      const database = new Database(record.target);
      database.run("create table keep (id integer)");
      database.close();

      await client.up("demo", { opener: async () => {}, log: () => {} });

      const reopened = new Database(record.target);
      expect(reopened.query("select name from sqlite_master").all()).toEqual([]);
      reopened.close();
    }));
});

describe("up containers", () => {
  it("builds the image and runs the container on the variant network", () =>
    withProject(async ({ up, engine, directory }) => {
      writeFileSync(join(directory, "be", "Dockerfile"), "FROM scratch\n");

      await up();

      const calls = engine.calls();
      expect(calls).toContainEqual(["build", "-f", join(directory, "be/Dockerfile"), "-t", "app:v-demo", directory]);
      expect(calls).toContainEqual(["network", "create", "v-net-demo"]);
      const run = runCall(engine, "v-be-demo");
      expect(run.slice(0, 6)).toEqual(["run", "-d", "--name", "v-be-demo", "--network", "v-net-demo"]);
      expect(flagValues(run, "-p")[0]).toMatch(/^0\.0\.0\.0:\d+:3000$/);
      expect(run.at(-1)).toBe("app:v-demo");
      expect(engine.state()).toEqual({ containers: ["v-be-demo", "v-fe-demo"], networks: ["v-net-demo"] });
    }));

  it("runs the build command of a static instance in its directory and mounts the output read-only", () =>
    withProject(
      async ({ up, engine, directory }) => {
        await up();

        expect(readFileSync(join(directory, "fe", "built.txt"), "utf8")).toBe("built\n");
        const run = runCall(engine, "v-fe-demo");
        expect(flagValues(run, "-v")).toContain(`${join(directory, "fe/dist")}:/usr/share/nginx/html:ro`);
        expect(run.at(-1)).toBe("nginx:alpine");
      },
      FE_BE.replace("container: { static: dist,", 'container: { build: "echo built > built.txt", static: dist,'),
    ));

  it("runs an image without building it", () =>
    withProject(
      async ({ up, engine }) => {
        await up();

        expect(engine.calls().some((call) => call[0] === "build")).toBe(false);
        expect(runCall(engine, "v-be-demo").at(-1)).toBe("redis:7");
      },
      FE_BE.replace("dockerfile: be/Dockerfile, port: 3000, image: app", "port: 3000, image: redis:7"),
    ));

  it("defaults the image name to v-<key>", () =>
    withProject(
      async ({ up, engine }) => {
        await up();

        expect(runCall(engine, "v-be-demo").at(-1)).toBe("v-be:v-demo");
      },
      FE_BE.replace("dockerfile: be/Dockerfile, port: 3000, image: app", "dockerfile: be/Dockerfile, port: 3000"),
    ));

  it("replaces a container of the same name", () =>
    withProject(async ({ up, engine }) => {
      engine.seed({ containers: ["v-be-demo"], networks: ["v-net-demo"] });

      await up();

      const calls = engine.calls();
      const removed = calls.findIndex((call) => call[0] === "rm" && call.includes("v-be-demo"));
      const started = calls.findIndex((call) => call[0] === "run" && call.includes("v-be-demo"));
      expect(removed).toBeGreaterThan(-1);
      expect(removed).toBeLessThan(started);
      expect(calls.some((call) => call[0] === "network" && call[1] === "create")).toBe(false);
    }));

  it("lets a container reach a database on host.docker.internal and passes the connection settings unchanged", () =>
    withProject(
      async ({ up, engine }) => {
        await up();

        const run = runCall(engine, "v-be-demo");
        expect(run).toContain("host.docker.internal:host-gateway");
        expect(flagValues(run, "-e")).toContain("POSTGRES_HOST=host.docker.internal");
        expect(flagValues(run, "-e")).toContain("POSTGRES_SCHEMA=v_demo");
      },
      FE_BE.replace(
        "  dialect: sqlite",
        "  dialect: postgres\n  host: host.docker.internal\n  user: u\n  password: p\n  database: d",
      ),
    ));

  it("orders the environment: database, instance env, container env; and expands volumes", () =>
    withProject(
      async ({ up, engine, directory }) => {
        await up();

        const run = runCall(engine, "v-be-demo");
        const environment = flagValues(run, "-e");
        expect(environment).toContain("SHARED=container");
        expect(environment).not.toContain("SHARED=instance");
        expect(environment).toContain("ONLY_INSTANCE=slug-demo");
        expect(environment).toContain("POSTGRES_USER=other");
        expect(flagValues(run, "-v")).toContain(`${directory}/data-demo:/data`);
      },
      FE_BE.replace(
        "  dialect: sqlite",
        "  dialect: postgres\n  host: localhost\n  user: u\n  password: p\n  database: d",
      ).replace(
        "      container: { dockerfile: be/Dockerfile, port: 3000, image: app }",
        [
          "      env: { SHARED: instance, ONLY_INSTANCE: 'slug-{{slug}}', POSTGRES_USER: other }",
          "      container:",
          "        dockerfile: be/Dockerfile",
          "        port: 3000",
          "        image: app",
          "        env: { SHARED: container }",
          "        volumes: ['{{worktree}}/data-{{slug}}:/data']",
        ].join("\n"),
      ),
    ));

  it("starts instances in their listed order and waits between two of them", () =>
    withProject(
      async ({ up, engine }) => {
        const started = Date.now();

        await up();

        const order = engine.calls().filter((call) => call[0] === "run");
        expect(order.map((call) => call[3])).toEqual(["v-be-demo", "v-fe-demo"]);
        expect(Date.now() - started).toBeGreaterThanOrEqual(950);
      },
      FE_BE.replace("startDelaySeconds: 0", "startDelaySeconds: 1"),
    ));

  it("uses the engine from variant.containerEngine", () =>
    withProject(
      async ({ up, engine, directory }) => {
        const bin = join(directory, "only-podman");
        mkdirSync(bin);
        symlinkSync(join(engine.bin, "docker"), join(bin, "podman"));
        process.env.PATH = `${bin}:/usr/bin:/bin`;

        await up();

        expect(engine.calls().some((call) => call[0] === "run")).toBe(true);
      },
      FE_BE.replace("variant:\n", "variant:\n  containerEngine: podman\n"),
    ));

  it("finds podman when docker is not installed", () =>
    withProject(async ({ up, engine, directory }) => {
      const bin = join(directory, "only-podman");
      mkdirSync(bin);
      symlinkSync(join(engine.bin, "docker"), join(bin, "podman"));
      process.env.PATH = `${bin}:/usr/bin:/bin`;

      await up();

      expect(engine.calls().some((call) => call[0] === "run")).toBe(true);
    }));

  it("fails before building or starting anything when there is no engine", () =>
    withProject(
      async ({ up, directory, database }) => {
        process.env.PATH = "/nonexistent";

        const failure = await up().catch((error: Error) => error);

        expect((failure as Error).message).toMatch(/docker.*podman/);
        expect(existsSync(join(directory, "fe", "built.txt"))).toBe(false);
        expect(database).toEqual([]);
      },
      FE_BE.replace("container: { static: dist,", 'container: { build: "echo built > built.txt", static: dist,'),
    ));

  it("does not start an instance without a container", () =>
    withProject(
      async ({ up, engine }) => {
        await up();

        expect(engine.calls().some((call) => call.includes("v-be-demo"))).toBe(false);
        expect(engine.state().containers).toEqual(["v-fe-demo"]);
      },
      FE_BE.replace(/ {6}container: \{ dockerfile[^\n]*\n/, "").replace(", proxy: { path: /api/, to: be }", ""),
    ));
});

describe("up mode switch and runtime state", () => {
  it("stops a recorded watch before containers start", () =>
    withProject(async ({ up, directory, localFile }) => {
      const watcher = spawn("sh", ["-c", "sleep 300"], { cwd: join(directory, "fe"), detached: true, stdio: "ignore" });
      spawned.push(watcher);
      const pid = watcher.pid as number;
      writeFileSync(
        localFile,
        `runtime:\n  slug: demo\n  mode: watch\n  instances:\n    fe: { port: 62060, pid: ${pid} }\n`,
      );

      await up();

      for (let attempt = 0; attempt < 100 && isProcessAlive(pid); attempt += 1) {
        await new Promise((done) => setTimeout(done, 50));
      }
      expect(isProcessAlive(pid)).toBe(false);
    }));

  it("records mode, slug, directory, database and the port and URL of every instance", () =>
    withProject(
      async ({ up, runtime, directory }) => {
        await up();

        expect(runtime()).toEqual({
          slug: "demo",
          mode: "up",
          dir: directory,
          db: { dialect: "sqlite", filename: "v_demo" },
          instances: {
            be: { port: expect.any(Number) },
            fe: { port: 62060, url: "http://demo.vw.localhost:62060" },
          },
        });
      },
      FE_BE,
      { "variants.local.yaml": "runtime:\n  instances:\n    fe: { port: 62060 }\n" },
    ));

  it("keeps other top-level keys of variants.local.yaml", () =>
    withProject(
      async ({ up, localFile }) => {
        await up();

        expect(parseYaml(readFileSync(localFile, "utf8")).custom).toBe("kept");
      },
      FE_BE,
      { "variants.local.yaml": "custom: kept\n" },
    ));
});

describe("up opening", () => {
  it("opens the URL of an instance with an open template after the start", () =>
    withProject(
      async ({ context }) => {
        const opened: string[] = [];
        const lines: string[] = [];

        await upVariant(context, "demo", { opener: (url) => void opened.push(url), log: (line) => lines.push(line) });

        expect(opened).toEqual(["http://demo.vw.localhost:62060"]);
        expect(lines).toContain("fe: http://demo.vw.localhost:62060");
      },
      FE_BE,
      { "variants.local.yaml": "runtime:\n  instances:\n    fe: { port: 62060 }\n" },
    ));
});

describe("static site configuration", () => {
  it("is written for a static instance and removed by down", () =>
    withProject(async ({ up, context }) => {
      await up();
      const path = join(context.stateDir, "demo.fe.nginx.conf");
      expect(existsSync(path)).toBe(true);

      await downVariant(context, "demo");

      expect(existsSync(path)).toBe(false);
    }));

  it("forwards the proxy path to the target container and accepts the open URL host", () =>
    withProject(async ({ up, context, engine }) => {
      await up();

      const text = readFileSync(join(context.stateDir, "demo.fe.nginx.conf"), "utf8");
      expect(text).toContain("server_name demo.vw.localhost;");
      expect(text).toContain("proxy_pass http://v-be-demo:3000/api/;");
      expect(flagValues(runCall(engine, "v-fe-demo"), "-v")).toContain(
        `${join(context.stateDir, "demo.fe.nginx.conf")}:/etc/nginx/conf.d/default.conf:ro`,
      );
    }, FE_BE));
});
