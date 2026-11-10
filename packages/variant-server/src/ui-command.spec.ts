import { afterEach, describe, expect, it } from "bun:test";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { createServer } from "node:net";
import { join } from "node:path";
import { createVariantClient } from "variant-api";
import { parse as parseYaml } from "yaml";
import { runUi, type UiCommandOptions } from "./index.js";
import { readEntry, readToken, tokenPath } from "./ui-watch.js";

const SERVE_SCRIPT = (module: string): string => `
import { runUi } from ${JSON.stringify(module)};
const abort = new AbortController();
process.on("SIGTERM", () => abort.abort());
process.on("SIGINT", () => abort.abort());
process.exit(await runUi({ cwd: process.argv[2], staticDir: process.argv[3], print: console.log, signal: abort.signal }));
`;

const toKill: number[] = [];
afterEach(() => {
  for (const pid of toKill.splice(0)) {
    try {
      process.kill(pid, "SIGKILL");
    } catch {
      // already gone
    }
  }
});

interface Project {
  directory: string;
  printed: string[];
  /** Runs `runUi` in this process; `abort` ends an attached run. */
  run: (options?: Partial<UiCommandOptions>) => Promise<number>;
  options: () => UiCommandOptions;
  put: (path: string, content: string) => void;
  runtime: () => { watches?: Record<string, unknown> } & Record<string, unknown>;
}

const withProject = async (
  run: (project: Project) => Promise<void>,
  yaml = "variant:\n  abbr: vw\n",
): Promise<void> => {
  const directory = realpathSync(mkdtempSync(join("/tmp", "variant-ui-command-")));
  const put = (path: string, content: string): void => {
    mkdirSync(join(directory, path, ".."), { recursive: true });
    writeFileSync(join(directory, path), content);
  };
  try {
    put("variants.yaml", `db:\n  dialect: sqlite\n${yaml}`);
    put("app/index.html", "<!doctype html>");
    const printed: string[] = [];
    const options = (): UiCommandOptions => ({
      cwd: directory,
      env: { ...process.env, VARIANT_OPEN: "0" },
      print: (line) => printed.push(line),
      staticDir: join(directory, "app"),
      respawn: [process.execPath, join(directory, "serve.ts"), directory, join(directory, "app")],
    });
    put("serve.ts", SERVE_SCRIPT(join(import.meta.dir, "index.ts")));
    await run({
      directory,
      printed,
      put,
      options,
      run: (overrides = {}) => runUi({ ...options(), ...overrides }),
      runtime: () => parseYaml(readFileSync(join(directory, ".cache/variant/state.yaml"), "utf8")),
    });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
};

const until = async (condition: () => boolean, ms = 5000): Promise<void> => {
  for (const deadline = Date.now() + ms; !condition(); await new Promise((r) => setTimeout(r, 25))) {
    if (Date.now() > deadline) {
      throw new Error("condition not met in time");
    }
  }
};

const freePort = (): Promise<number> =>
  new Promise((resolve) => {
    const probe = createServer();
    probe.listen(0, "127.0.0.1", () => {
      const port = (probe.address() as { port: number }).port;
      probe.close(() => resolve(port));
    });
  });

/** An attached run in this process, started and ended through its abort signal. */
const attached = async (project: Project, overrides: Partial<UiCommandOptions> = {}) => {
  const abort = new AbortController();
  const done = project.run({ ...overrides, signal: abort.signal });
  await until(() => project.printed.length > 0 || existsSync(tokenPath(project.directory)));
  const stop = (): Promise<number> => {
    abort.abort();
    return done;
  };
  return { stop, done };
};

describe("variant ui", () => {
  it("prints http://ui.<abbr>.localhost:<port>/?token=<token> and keeps running", () =>
    withProject(async (project) => {
      const server = await attached(project);
      try {
        expect(project.printed[0]).toMatch(/^http:\/\/ui\.vw\.localhost:\d+\/\?token=[A-Za-z0-9_-]{22,}$/);
        const response = await fetch(`http://127.0.0.1:${new URL(project.printed[0] as string).port}/api/variants`, {
          headers: { authorization: `Bearer ${new URL(project.printed[0] as string).searchParams.get("token")}` },
        });
        expect(response.status).toBe(200);
      } finally {
        expect(await server.stop()).toBe(0);
      }
    }));

  it("uses the abbreviation of the project in the host name", () =>
    withProject(async (project) => {
      const server = await attached(project);
      try {
        expect(project.printed[0]).toMatch(/^http:\/\/ui\.shop\.localhost:/);
      } finally {
        await server.stop();
      }
    }, "variant:\n  abbr: shop\n"));

  it("listens on VARIANT_UI_PORT", () =>
    withProject(async (project) => {
      const port = await freePort();
      const server = await attached(project, {
        env: { ...project.options().env, VARIANT_UI_PORT: String(port) },
      });
      try {
        expect(new URL(project.printed[0] as string).port).toBe(String(port));
      } finally {
        await server.stop();
      }
    }));

  it("listens on variant.ui.port when VARIANT_UI_PORT is not set", () =>
    withProject(async (project) => {
      const port = await freePort();
      project.put("variants.yaml", `db:\n  dialect: sqlite\nvariant:\n  abbr: vw\n  ui:\n    port: ${port}\n`);
      const server = await attached(project, { env: { ...project.options().env, VARIANT_UI_PORT: undefined } });
      try {
        expect(new URL(project.printed[0] as string).port).toBe(String(port));
      } finally {
        await server.stop();
      }
    }));

  it("lets VARIANT_UI_PORT win over variant.ui.port", () =>
    withProject(async (project) => {
      const configured = await freePort();
      const given = await freePort();
      project.put("variants.yaml", `db:\n  dialect: sqlite\nvariant:\n  abbr: vw\n  ui:\n    port: ${configured}\n`);
      const server = await attached(project, {
        env: { ...project.options().env, VARIANT_UI_PORT: String(given) },
      });
      try {
        expect(new URL(project.printed[0] as string).port).toBe(String(given));
      } finally {
        await server.stop();
      }
    }));

  it("treats an empty VARIANT_UI_PORT as unset", () =>
    withProject(async (project) => {
      const port = await freePort();
      project.put("variants.yaml", `db:\n  dialect: sqlite\nvariant:\n  abbr: vw\n  ui:\n    port: ${port}\n`);
      const server = await attached(project, { env: { ...project.options().env, VARIANT_UI_PORT: "" } });
      try {
        expect(new URL(project.printed[0] as string).port).toBe(String(port));
      } finally {
        await server.stop();
      }
    }));

  it("fails naming VARIANT_UI_PORT when it is not a port number", () =>
    withProject(async (project) => {
      const failure = await project
        .run({ env: { ...project.options().env, VARIANT_UI_PORT: "abc" } })
        .catch((error: unknown) => error);

      expect(failure).toBeInstanceOf(Error);
      expect((failure as Error).message).toContain("VARIANT_UI_PORT");
      expect(project.printed).toEqual([]);
    }));

  it("picks a free port of variant.ports.range", () =>
    withProject(async (project) => {
      project.put(
        "variants.yaml",
        'db:\n  dialect: sqlite\nvariant:\n  abbr: vw\n  ports:\n    range: "50000-50009"\n',
      );
      const server = await attached(project, { isFree: async (port) => port === 50003 });
      try {
        expect(new URL(project.printed[0] as string).port).toBe("50003");
      } finally {
        await server.stop();
      }
    }));

  it("picks from the default range when none is configured", () =>
    withProject(async (project) => {
      const server = await attached(project);
      try {
        const port = Number(new URL(project.printed[0] as string).port);
        expect(port).toBeGreaterThanOrEqual(42000);
        expect(port).toBeLessThanOrEqual(42999);
      } finally {
        await server.stop();
      }
    }));

  it("keeps a port named by VARIANT_UI_PORT that lies outside the range", () =>
    withProject(async (project) => {
      const port = await freePort();
      project.put(
        "variants.yaml",
        'db:\n  dialect: sqlite\nvariant:\n  abbr: vw\n  ports:\n    range: "50000-50009"\n',
      );
      const server = await attached(project, { env: { ...project.options().env, VARIANT_UI_PORT: String(port) } });
      try {
        expect(new URL(project.printed[0] as string).port).toBe(String(port));
      } finally {
        await server.stop();
      }
    }));

  it("--detach prints the URL and returns while the server keeps serving", () =>
    withProject(async (project) => {
      const code = await project.run({ detach: true });
      const entry = readEntry(project.directory);
      toKill.push(entry?.pid as number);

      expect(code).toBe(0);
      expect(project.printed[0]).toMatch(/^http:\/\/ui\.vw\.localhost:\d+\/\?token=/);
      const url = new URL(project.printed[0] as string);
      const response = await fetch(`http://127.0.0.1:${url.port}/api/variants`, {
        headers: { authorization: `Bearer ${url.searchParams.get("token")}` },
      });
      expect(response.status).toBe(200);
      expect(await project.run({ stop: true })).toBe(0);
    }));
});

describe("variant ui as a watch of main", () => {
  it("records its port, pid and URL without the token, which variant list shows", () =>
    withProject(async (project) => {
      const server = await attached(project);
      try {
        const entry = readEntry(project.directory);
        expect(entry).toEqual({
          port: Number(new URL(project.printed[0] as string).port),
          pid: process.pid,
          url: `http://ui.vw.localhost:${new URL(project.printed[0] as string).port}`,
        });

        const main = (await createVariantClient({ cwd: project.directory, worktree: false }).list()).find(
          (variant) => variant.slug === "main",
        );
        expect(main?.watches?.["variant-ui"]).toMatchObject({ pid: process.pid, alive: true, url: entry?.url });
      } finally {
        await server.stop();
      }
    }));

  it("keeps the other runtime entries of main and removes only its own, with the token file, on exit", () =>
    withProject(async (project) => {
      project.put(
        "variants.local.yaml",
        "runtime:\n  slug: main\n  mode: watch\n  watches:\n    fe: { port: 62060, pid: 4242 }\n",
      );
      const server = await attached(project);
      expect(project.runtime().watches).toMatchObject({ fe: { port: 62060 }, "variant-ui": { pid: process.pid } });
      expect(existsSync(tokenPath(project.directory))).toBe(true);

      await server.stop();

      expect(project.runtime()).toEqual({ slug: "main", mode: "watch", watches: { fe: { port: 62060, pid: 4242 } } });
      expect(existsSync(tokenPath(project.directory))).toBe(false);
    }));

  it("leaves no file behind when the runtime held nothing but the server", () =>
    withProject(async (project) => {
      const server = await attached(project);
      await server.stop();

      expect(existsSync(join(project.directory, "variants.local.yaml"))).toBe(false);
    }));

  it("keeps the token in a file only its owner can read and write", () =>
    withProject(async (project) => {
      const server = await attached(project);
      try {
        expect(statSync(tokenPath(project.directory)).mode & 0o777).toBe(0o600);
        expect(readToken(project.directory)).toBe(
          new URL(project.printed[0] as string).searchParams.get("token") as string,
        );
      } finally {
        await server.stop();
      }
    }));
});

describe("one server per project", () => {
  it("prints the running server's URL with its token and starts nothing", () =>
    withProject(async (project) => {
      const server = await attached(project);
      try {
        const before = readEntry(project.directory);
        const second: string[] = [];

        const code = await project.run({ print: (line) => second.push(line) });

        expect(code).toBe(0);
        expect(second).toEqual([project.printed[0] as string]);
        expect(readEntry(project.directory)).toEqual(before);
      } finally {
        await server.stop();
      }
    }));

  it("replaces an entry whose process is dead", () =>
    withProject(async (project) => {
      const dead = spawnSync("true").pid;
      project.put(
        "variants.local.yaml",
        `runtime:\n  watches:\n    variant-ui: { port: 62100, pid: ${dead}, url: 'http://ui.vw.localhost:62100' }\n`,
      );
      const server = await attached(project);
      try {
        expect(readEntry(project.directory)?.pid).toBe(process.pid);
        expect(project.printed[0]).not.toContain("62100");
      } finally {
        await server.stop();
      }
    }));
});

describe("variant ui --stop", () => {
  it("stops the server, removes its entry and token file, and exits 0", () =>
    withProject(async (project) => {
      expect(await project.run({ detach: true })).toBe(0);
      const pid = readEntry(project.directory)?.pid as number;
      toKill.push(pid);

      expect(await project.run({ stop: true })).toBe(0);

      expect(() => process.kill(pid, 0)).toThrow();
      expect(readEntry(project.directory)).toBeUndefined();
      expect(existsSync(tokenPath(project.directory))).toBe(false);
    }));

  it("exits 0 when no server runs", () =>
    withProject(async (project) => {
      expect(await project.run({ stop: true })).toBe(0);
    }));
});
