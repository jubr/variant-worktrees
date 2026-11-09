import { afterEach, describe, expect, it } from "bun:test";
import { type ChildProcess, execFileSync, spawn, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadConfig } from "variant-config";
import { createClient } from "../index.js";

const sleepers: ChildProcess[] = [];
afterEach(() => {
  for (const child of sleepers.splice(0)) {
    child.kill("SIGKILL");
  }
});
const sleeper = (): number => {
  const child = spawn("sleep", ["30"], { stdio: "ignore" });
  sleepers.push(child);
  return child.pid as number;
};
const pause = (ms: number): Promise<void> => new Promise((done) => setTimeout(done, ms));

type Client = ReturnType<typeof createClient>;

const withProject = async (
  run: (project: {
    directory: string;
    put: (path: string, content: string) => void;
    client: (cwd?: string) => Client;
  }) => Promise<void>,
  env: NodeJS.ProcessEnv = {},
): Promise<void> => {
  const directory = realpathSync(mkdtempSync(join("/tmp", "variant-status-")));
  const put = (path: string, content: string): void => {
    mkdirSync(join(directory, path, ".."), { recursive: true });
    writeFileSync(join(directory, path), content);
  };
  try {
    put(
      "variants.yaml",
      "db:\n  dialect: sqlite\nvariant:\n  watches:\n    fe: { kind: vite, dir: fe }\n    be: { kind: nestjs, dir: be }\n",
    );
    const client = (cwd = directory): Client =>
      createClient({
        config: loadConfig({ cwd: directory, env }),
        cwd,
        stateDir: join(directory, ".cache", "variants"),
        worktree: false,
      });
    await run({ directory, put, client });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
};

const runtimeFile = (...lines: string[]): string => `runtime:\n${lines.map((line) => `  ${line}`).join("\n")}\n`;

describe("client.status", () => {
  it("returns the record of one variant with its runtime facts", () =>
    withProject(async ({ put, client, directory }) => {
      put(
        "_v-demo/variants.local.yaml",
        runtimeFile(
          "slug: demo",
          "mode: watch",
          "watches:",
          "  fe: { port: 62060, url: 'http://demo.vw.localhost:62060/' }",
        ),
      );

      const status = await client().status("demo");

      expect(status).toMatchObject({
        slug: "demo",
        worktree: join(directory, "_v-demo"),
        mode: "watch",
        url: "http://demo.vw.localhost:62060/",
        watches: { fe: { port: 62060 } },
      });
    }));

  it("describes only the variant that was asked for", () =>
    withProject(async ({ put, client }) => {
      put("_v-alpha/variants.local.yaml", runtimeFile("slug: alpha", "mode: up"));
      put("_v-beta/variants.local.yaml", runtimeFile("slug: beta", "mode: watch"));

      const status = await client().status("alpha");

      expect(Array.isArray(status)).toBe(false);
      expect(status.slug).toBe("alpha");
      expect(status.mode).toBe("up");
    }));

  it("fails naming the slug when nothing is known about it", () =>
    withProject(async ({ client }) => {
      await expect(client().status("ghost")).rejects.toThrow("Unknown variant: ghost");
    }));

  it("knows a variant that has only a database target", () =>
    withProject(async ({ put, client, directory }) => {
      put(".cache/variants/orphan.db", "");

      const status = await client().status("orphan");

      expect(status.target).toBe(join(directory, ".cache", "variants", "orphan.db"));
      expect(status.mode).toBeUndefined();
    }));

  it("takes the slug from the worktree it runs in when none is given", () =>
    withProject(async ({ client, directory }) => {
      const repo = join(directory, "repo");
      const git = (...args: string[]): void => void execFileSync("git", ["-C", repo, ...args], { stdio: "ignore" });
      execFileSync("git", ["init", "-q", "-b", "main", repo]);
      git("config", "user.email", "variant@example.test");
      git("config", "user.name", "Variant Tests");
      writeFileSync(join(repo, "README.md"), "x\n");
      git("add", "README.md");
      git("commit", "-q", "-m", "initial");
      git("worktree", "add", "-q", "-b", "feat/demo", join(directory, "_v-demo"));
      writeFileSync(join(directory, "_v-demo", "variants.local.yaml"), runtimeFile("slug: demo", "mode: watch"));

      const status = await client(join(directory, "_v-demo")).status();

      expect(status.slug).toBe("demo");
    }));
});

describe("status runtime meta information", () => {
  it("carries every value of the runtime section and the file it came from", () =>
    withProject(async ({ put, client, directory }) => {
      put(
        "_v-demo/variants.local.yaml",
        runtimeFile(
          "slug: demo",
          "mode: up",
          `dir: ${join(directory, "_v-demo")}`,
          "db: { dialect: postgres, host: db.example, schema: v_demo }",
          "watches:",
          "  be: { port: 62061 }",
        ),
      );

      const { runtime } = await client().status("demo");

      expect(runtime).toEqual({
        file: join(directory, "_v-demo", "variants.local.yaml"),
        slug: "demo",
        mode: "up",
        dir: join(directory, "_v-demo"),
        db: { dialect: "postgres", host: "db.example", schema: "v_demo" },
        watches: { be: { port: 62061 } },
      });
    }));

  it("returns createdAt and a watch startedAt", () =>
    withProject(async ({ put, client }) => {
      put(
        "_v-demo/variants.local.yaml",
        runtimeFile(
          "slug: demo",
          "createdAt: 2026-11-04_12:22:05",
          "watches:",
          "  fe: { startedAt: 2026-11-04_12:30:00 }",
        ),
      );

      const { runtime } = await client().status("demo");

      expect(runtime?.createdAt).toBe("2026-11-04_12:22:05");
      expect(runtime?.watches?.fe?.startedAt).toBe("2026-11-04_12:30:00");
    }));

  it("reports the log file of a detached watch on the record and in the runtime", () =>
    withProject(async ({ put, client }) => {
      put(
        "_v-demo/variants.local.yaml",
        runtimeFile("slug: demo", "mode: watch", "log: /work/_v-demo/variants.watch.log"),
      );

      const status = await client().status("demo");

      expect(status.log).toBe("/work/_v-demo/variants.watch.log");
      expect(status.runtime?.log).toBe("/work/_v-demo/variants.watch.log");
    }));

  it("redacts the database password", () =>
    withProject(async ({ put, client }) => {
      put(
        "_v-demo/variants.local.yaml",
        runtimeFile("slug: demo", "db: { dialect: postgres, host: h, password: secret }"),
      );

      const status = await client().status("demo");

      expect(status.runtime?.db?.password).toBe("***");
      expect(JSON.stringify(status)).not.toContain("secret");
    }));

  it("does not apply VARIANT_<KEY>_* overrides, which describe only the variant being run", () =>
    withProject(
      async ({ put, client }) => {
        put("_v-demo/variants.local.yaml", runtimeFile("slug: demo", "watches:", "  fe: { port: 62060 }"));

        expect((await client().status("demo")).runtime?.watches?.fe?.port).toBe(62060);
      },
      { VARIANT_FE_PORT: "62070" },
    ));

  it("has no runtime and no mode for a variant without a runtime state", () =>
    withProject(async ({ put, client }) => {
      put(".cache/variants/demo.yaml", "slug: demo\ntarget: v_demo\ndialect: sqlite\nstatePath: ''\ncreatedAt: now\n");

      const status = await client().status("demo");

      expect(status.runtime).toBeUndefined();
      expect(status.mode).toBeUndefined();
    }));
});

describe("uptime of a variant", () => {
  it("is the uptime of the live recorded process, per watch and for the variant", () =>
    withProject(async ({ put, client }) => {
      put(
        "_v-demo/variants.local.yaml",
        runtimeFile("slug: demo", "mode: watch", "watches:", `  fe: { pid: ${sleeper()} }`),
      );

      const status = await client().status("demo");

      expect(status.watches?.fe?.alive).toBe(true);
      expect(status.watches?.fe?.uptimeSeconds).toBeLessThan(10);
      expect(status.uptimeSeconds).toBe(status.watches?.fe?.uptimeSeconds);
      expect(status.runtime?.watches?.fe?.uptimeSeconds).toBe(status.uptimeSeconds);
    }));

  it("is the uptime of the process that has run longest", () =>
    withProject(async ({ put, client }) => {
      const be = sleeper();
      await pause(2100);
      const fe = sleeper();
      put(
        "_v-demo/variants.local.yaml",
        runtimeFile("slug: demo", "watches:", `  be: { pid: ${be} }`, `  fe: { pid: ${fe} }`),
      );

      const status = await client().status("demo");

      expect(status.watches?.be?.uptimeSeconds).toBeGreaterThanOrEqual(2);
      expect(status.watches?.fe?.uptimeSeconds).toBeLessThan(status.watches?.be?.uptimeSeconds as number);
      expect(status.uptimeSeconds).toBe(status.watches?.be?.uptimeSeconds);
    }));

  it("is missing for a recorded pid that belongs to no process", () =>
    withProject(async ({ put, client }) => {
      put(
        "_v-demo/variants.local.yaml",
        runtimeFile("slug: demo", "watches:", `  fe: { pid: ${spawnSync("true").pid} }`),
      );

      const status = await client().status("demo");

      expect(status.watches?.fe?.alive).toBe(false);
      expect(status.watches?.fe?.uptimeSeconds).toBeUndefined();
      expect(status.uptimeSeconds).toBeUndefined();
    }));

  it("is missing for a variant started with up, which records no pids and no log", () =>
    withProject(async ({ put, client }) => {
      put("_v-demo/variants.local.yaml", runtimeFile("slug: demo", "mode: up", "watches:", "  fe: { port: 62060 }"));

      const status = await client().status("demo");

      expect(status.uptimeSeconds).toBeUndefined();
      expect(status.log).toBeUndefined();
    }));
});

describe("client.list with verbose", () => {
  const populate = (put: (path: string, content: string) => void): void => {
    put(
      "_v-alpha/variants.local.yaml",
      runtimeFile(
        "slug: alpha",
        "mode: watch",
        "db: { dialect: postgres, host: h, password: secret }",
        "watches:",
        "  fe: { port: 62060 }",
      ),
    );
    put(".cache/variants/beta.db", "");
  };

  it("gives every record what status gives for its slug", () =>
    withProject(async ({ put, client }) => {
      populate(put);

      const verbose = await client().list({ verbose: true });

      expect(verbose.map(({ slug }) => slug)).toEqual(["alpha", "beta"]);
      for (const record of verbose) {
        expect(record).toEqual(await client().status(record.slug));
      }
      expect(verbose[0]?.runtime?.db?.password).toBe("***");
    }));

  it("keeps the runtime object out of the records without verbose", () =>
    withProject(async ({ put, client }) => {
      populate(put);

      for (const record of await client().list()) {
        expect(record.runtime).toBeUndefined();
      }
    }));
});
