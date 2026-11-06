import { describe, expect, it } from "bun:test";
import { execFileSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

interface McpResult {
  lines: string[];
  exitCode: number;
}

const tempDirectory = (): string => mkdtempSync(join("/tmp", "variant-mcp-"));

const configFile = (directory: string, seed = false): string => {
  const path = join(directory, "variants.yaml");
  writeFileSync(path, `db:\n  dialect: sqlite\n${seed ? 'variant:\n  seed: "printf seeded"\n' : ""}`);
  return path;
};

interface McpOptions {
  /** The working directory of the server; the package directory by default. */
  cwd?: string;
  env?: Record<string, string>;
}

function mcp(messages: object[], configPath: string, options: McpOptions = {}): Promise<McpResult> {
  const input = `${messages.map((message) => JSON.stringify(message)).join("\n")}\n`;
  return new Promise((resolve) => {
    const proc = Bun.spawn(["bun", "run", `${import.meta.dir}/../src/mcp.ts`, "--config", configPath], {
      cwd: options.cwd ?? `${import.meta.dir}/..`,
      env: { ...process.env, VARIANT_WORKTREE: "0", ...options.env },
      stdin: new Blob([input]),
      stdout: "pipe",
      stderr: "pipe",
    });
    proc.exited.then(async (exitCode) => {
      const stdout = await new Response(proc.stdout).text();
      resolve({ lines: stdout.trim().split("\n").filter(Boolean), exitCode });
    });
  });
}

function initMessages(): object[] {
  return [
    {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "test", version: "1.0.0" },
      },
    },
    { jsonrpc: "2.0", method: "notifications/initialized" },
  ];
}

describe("MCP server", () => {
  it("variant_init writes into the working directory and offers its steps as inputs", async () => {
    const directory = tempDirectory();
    try {
      const { lines } = await mcp(
        [
          ...initMessages(),
          { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} },
          {
            jsonrpc: "2.0",
            id: 3,
            method: "tools/call",
            params: { name: "variant_init", arguments: { prefix: "wt-", mise: false } },
          },
        ],
        join(directory, "none.yaml"),
        { cwd: directory },
      );
      const tools = JSON.parse(lines[1] ?? "{}").result.tools as {
        name: string;
        inputSchema: { properties: object };
      }[];
      const init = tools.find((tool) => tool.name === "variant_init");
      expect(Object.keys(init?.inputSchema.properties ?? {})).toEqual(["prefix", "file", "gitignore", "mise", "force"]);
      const result = JSON.parse(JSON.parse(lines[2] ?? "{}").result.content[0].text);
      expect(result).toMatchObject({ directory: realpathSync(directory), prefix: "wt-", mise: { status: "skipped" } });
      expect(readFileSync(join(directory, "variants.yaml"), "utf8")).toContain("prefix: wt-");
      expect(readFileSync(join(directory, ".gitignore"), "utf8")).toBe("wt-*\n");
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("lists lifecycle tools without variant_free", async () => {
    const directory = tempDirectory();
    try {
      const { lines } = await mcp(
        [...initMessages(), { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} }],
        configFile(directory),
      );
      const response = JSON.parse(lines.at(-1) ?? "{}");
      const names = response.result.tools.map((tool: { name: string }) => tool.name);
      expect(names).toEqual([
        "variant_init",
        "variant_config",
        "variant_create",
        "variant_list",
        "variant_status",
        "variant_provision",
        "variant_up",
        "variant_down",
        "variant_deprovision",
        "variant_watch",
        "variant_implode",
      ]);
      expect(names).not.toContain("variant_free");
      expect(names).not.toContain("variant_destroy");
      expect(names).not.toContain("variant_switch");
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("creates, lists, and implodes a variant through MCP", async () => {
    const directory = realpathSync(tempDirectory());
    const configPath = configFile(directory);
    execFileSync("git", ["init", "-q", "-b", "main", directory]);
    execFileSync("git", ["-C", directory, "config", "user.email", "variant@example.test"]);
    execFileSync("git", ["-C", directory, "config", "user.name", "Variant Tests"]);
    execFileSync("git", ["-C", directory, "add", "variants.yaml"]);
    execFileSync("git", ["-C", directory, "commit", "-q", "-m", "initial"]);
    const options = { cwd: directory, env: { VARIANT_WORKTREE: "1" } };
    try {
      const create = await mcp(
        [
          ...initMessages(),
          {
            jsonrpc: "2.0",
            id: 3,
            method: "tools/call",
            params: { name: "variant_create", arguments: { slug: "test-feature" } },
          },
        ],
        configPath,
        options,
      );
      expect(JSON.parse(create.lines.at(-1) ?? "{}").result.isError).not.toBe(true);

      const list = await mcp(
        [
          ...initMessages(),
          { jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "variant_list", arguments: {} } },
        ],
        configPath,
        options,
      );
      expect(JSON.parse(list.lines.at(-1) ?? "{}").result.content[0].text).toContain("test-feature");

      const implode = await mcp(
        [
          ...initMessages(),
          {
            jsonrpc: "2.0",
            id: 5,
            method: "tools/call",
            params: { name: "variant_implode", arguments: { slug: "test-feature" } },
          },
        ],
        configPath,
        options,
      );
      expect(JSON.parse(implode.lines.at(-1) ?? "{}").result.isError).not.toBe(true);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("runs configured provision commands", async () => {
    const directory = tempDirectory();
    const configPath = configFile(directory, true);
    try {
      const result = await mcp(
        [
          ...initMessages(),
          {
            jsonrpc: "2.0",
            id: 6,
            method: "tools/call",
            params: { name: "variant_provision", arguments: { slug: "test-feature" } },
          },
        ],
        configPath,
      );
      const response = JSON.parse(result.lines.at(-1) ?? "{}");
      expect(response.result.content[0].text).toContain("seeded");
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("takes detach away from variant_watch and offers force on variant_implode", async () => {
    const directory = tempDirectory();
    try {
      const { lines } = await mcp(
        [...initMessages(), { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} }],
        configFile(directory),
      );
      const tools = JSON.parse(lines.at(-1) ?? "{}").result.tools as {
        name: string;
        inputSchema: { properties: Record<string, unknown> };
      }[];
      const properties = (name: string) =>
        Object.keys(tools.find((tool) => tool.name === name)?.inputSchema.properties ?? {});

      expect(properties("variant_create")).toEqual(["slug", "from", "verbose"]);
      expect(properties("variant_provision")).toEqual(["slug", "from", "verbose"]);
      expect(properties("variant_up")).toEqual(["slug", "from", "verbose"]);
      expect(properties("variant_watch")).toEqual(["slug", "from", "reprovision", "verbose"]);
      expect(properties("variant_down")).not.toContain("from");
      expect(properties("variant_implode")).not.toContain("from");
      expect(properties("variant_implode")).toContain("force");
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("starts the new branch at from", async () => {
    const parent = realpathSync(mkdtempSync(join("/tmp", "variant-mcp-from-")));
    const repo = join(parent, "repo");
    const git = (...args: string[]): string => execFileSync("git", ["-C", repo, ...args], { encoding: "utf8" }).trim();
    try {
      execFileSync("git", ["init", "-q", "-b", "main", repo]);
      git("config", "user.email", "variant@example.test");
      git("config", "user.name", "Variant Tests");
      writeFileSync(join(repo, "README.md"), "test\n");
      git("add", "README.md");
      git("commit", "-q", "-m", "initial");
      git("switch", "-q", "-c", "side");
      writeFileSync(join(repo, "side.txt"), "side\n");
      git("add", "side.txt");
      git("commit", "-q", "-m", "side work");
      const side = git("rev-parse", "HEAD");
      git("switch", "-q", "main");

      const result = await mcp(
        [
          ...initMessages(),
          {
            jsonrpc: "2.0",
            id: 3,
            method: "tools/call",
            params: { name: "variant_create", arguments: { slug: "add-auth", from: side } },
          },
        ],
        configFile(repo),
        { cwd: repo, env: { VARIANT_WORKTREE: "1" } },
      );
      const response = JSON.parse(result.lines.at(-1) ?? "{}");

      expect(response.result.isError).not.toBe(true);
      expect(
        execFileSync("git", ["-C", join(repo, "_v-add-auth"), "rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
      ).toBe(side);
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });
});

const call = (id: number, name: string, args: object = {}): object => ({
  jsonrpc: "2.0",
  id,
  method: "tools/call",
  params: { name, arguments: args },
});

const answer = (result: McpResult, id: number): { isError?: boolean; text: string } => {
  const response = result.lines.map((line) => JSON.parse(line)).find((message) => message.id === id);
  return { isError: response.result.isError, text: response.result.content[0].text };
};

describe("MCP runtime tools", () => {
  it("variant_up starts the containers and reports mode, target, ports, URLs and container names", async () => {
    const directory = realpathSync(tempDirectory());
    try {
      mkdirSync(join(directory, "be"));
      mkdirSync(join(directory, "bin"));
      writeFileSync(
        join(directory, "bin", "docker"),
        '#!/bin/sh\nif [ "$1" = inspect ]; then exit 1; fi\nif [ "$1" = network ] && [ "$2" = inspect ]; then exit 1; fi\nexit 0\n',
      );
      chmodSync(join(directory, "bin", "docker"), 0o755);
      const configPath = join(directory, "variants.yaml");
      writeFileSync(
        configPath,
        [
          "db:",
          "  dialect: sqlite",
          "variant:",
          "  open: false",
          "  supervise: { startDelaySeconds: 0 }",
          "  watches:",
          "    be:",
          "      kind: nestjs",
          "      dir: be",
          "      url: http://${slug}.vw.localhost:${port}",
          "      container: { dockerfile: be/Dockerfile, internalPort: 3000 }",
          "",
        ].join("\n"),
      );

      const result = await mcp([...initMessages(), call(3, "variant_up", { slug: "test-feature" })], configPath, {
        cwd: directory,
        env: { PATH: `${join(directory, "bin")}:${process.env.PATH}` },
      });

      const { isError, text } = answer(result, 3);
      expect(isError).not.toBe(true);
      const up = JSON.parse(text);
      expect(up).toMatchObject({ slug: "test-feature", mode: "up", worktree: directory });
      expect(up.target).toContain("test-feature");
      expect(up.watches.be).toEqual({
        port: expect.any(Number),
        url: `http://test-feature.vw.localhost:${up.watches.be.port}`,
        container: "v-be-test-feature",
      });
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("variant_watch returns with the processes running and variant_down stops them", async () => {
    const directory = realpathSync(tempDirectory());
    try {
      mkdirSync(join(directory, "be"));
      const configPath = join(directory, "variants.yaml");
      writeFileSync(
        configPath,
        "db:\n  dialect: sqlite\nvariant:\n  open: false\n  watches:\n    be: { kind: nestjs, dir: be, watch: 'sleep 300' }\n",
      );

      const watched = answer(
        await mcp([...initMessages(), call(3, "variant_watch", { slug: "test-feature" })], configPath, {
          cwd: directory,
        }),
        3,
      );
      const watch = JSON.parse(watched.text);
      const pid = watch.watches.be.pid as number;
      try {
        expect(watched.isError).not.toBe(true);
        expect(watch).toMatchObject({ slug: "test-feature", mode: "watch", worktree: directory, exitCode: 0 });
        expect(() => process.kill(pid, 0)).not.toThrow();

        const down = answer(
          await mcp([...initMessages(), call(4, "variant_down", { slug: "test-feature" })], configPath, {
            cwd: directory,
          }),
          4,
        );

        expect(JSON.parse(down.text).processes).toEqual([{ key: "be", pid }]);
        await new Promise((done) => setTimeout(done, 200));
        expect(() => process.kill(pid, 0)).toThrow();
      } finally {
        try {
          process.kill(-pid, "SIGKILL");
        } catch {
          // already stopped
        }
      }
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("variant_implode refuses unmerged work naming force and removes the worktree when forced", async () => {
    const parent = realpathSync(tempDirectory());
    const repo = join(parent, "repo");
    const git = (cwd: string, ...args: string[]): string =>
      execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8" }).trim();
    try {
      execFileSync("git", ["init", "-q", "-b", "main", repo]);
      git(repo, "config", "user.email", "variant@example.test");
      git(repo, "config", "user.name", "Variant Tests");
      writeFileSync(join(repo, "variants.yaml"), "db:\n  dialect: sqlite\n");
      writeFileSync(join(repo, ".gitignore"), ".cache\n_v-*\n");
      git(repo, "add", ".");
      git(repo, "commit", "-q", "-m", "initial");
      const configPath = join(repo, "variants.yaml");
      const options = { cwd: repo, env: { VARIANT_WORKTREE: "1" } };

      const created = JSON.parse(
        answer(await mcp([...initMessages(), call(3, "variant_create", { slug: "demo" })], configPath, options), 3)
          .text,
      );
      writeFileSync(join(created.worktree, "work.txt"), "unmerged\n");
      git(created.worktree, "add", "work.txt");
      git(created.worktree, "commit", "-q", "-m", "work");

      const refused = answer(
        await mcp([...initMessages(), call(4, "variant_implode", { slug: "demo" })], configPath, options),
        4,
      );
      expect(refused.isError).toBe(true);
      expect(refused.text).toContain("force");

      const forced = answer(
        await mcp([...initMessages(), call(5, "variant_implode", { slug: "demo", force: true })], configPath, options),
        5,
      );
      expect(forced.isError).not.toBe(true);
      expect(JSON.parse(forced.text)).toMatchObject({
        slug: "demo",
        worktreeRemoved: true,
        worktree: created.worktree,
      });
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });
});

describe("MCP status and verbose list", () => {
  const withRuntime = async (run: (directory: string, configPath: string) => Promise<void>): Promise<void> => {
    const directory = realpathSync(tempDirectory());
    try {
      mkdirSync(join(directory, "_v-demo"));
      writeFileSync(
        join(directory, "_v-demo", "variants.local.yaml"),
        "runtime:\n  slug: demo\n  mode: watch\n  log: /work/_v-demo/variants.watch.log\n  db: { dialect: postgres, host: h, password: secret }\n  watches:\n    fe: { port: 62060, url: 'http://demo.vw.localhost:62060/' }\n",
      );
      await run(directory, configFile(directory));
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  };

  it("variant_status returns the record of one variant with its runtime meta information, password redacted", () =>
    withRuntime(async (directory, configPath) => {
      const result = await mcp([...initMessages(), call(2, "variant_status", { slug: "demo" })], configPath, {
        cwd: directory,
      });
      const { isError, text } = answer(result, 2);
      const status = JSON.parse(text);

      expect(isError).not.toBe(true);
      expect(status).toMatchObject({
        slug: "demo",
        mode: "watch",
        url: "http://demo.vw.localhost:62060/",
        log: "/work/_v-demo/variants.watch.log",
        runtime: { file: join(directory, "_v-demo", "variants.local.yaml"), watches: { fe: { port: 62060 } } },
      });
      expect(status.runtime.db.password).toBe("***");
      expect(text).not.toContain("secret");
    }));

  it("variant_config carries the warning of an extra property", async () => {
    const directory = tempDirectory();
    try {
      const configPath = join(directory, "variants.yaml");
      writeFileSync(configPath, "db:\n  dialect: sqlite\n  colour: red\n");
      const result = await mcp([...initMessages(), call(2, "variant_config")], configPath, { cwd: directory });
      const config = JSON.parse(answer(result, 2).text);

      expect(config.warnings).toEqual([`${configPath}: unknown key db.colour`]);
      expect(config.db).not.toHaveProperty("colour");
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("reads a configuration with old names under the current ones and does not rewrite it", async () => {
    const directory = tempDirectory();
    try {
      const configPath = join(directory, "variants.yaml");
      const old = "db:\n  dialect: sqlite\nvariant:\n  instances:\n    be: { kind: nestjs, dir: . }\n";
      writeFileSync(configPath, old);
      const result = await mcp([...initMessages(), call(2, "variant_config")], configPath, {
        cwd: directory,
        env: { CI: "", VARIANT_MIGRATE: "" },
      });
      const config = JSON.parse(answer(result, 2).text);

      expect(Object.keys(config.variant.watches)).toEqual(["be"]);
      expect(config.migrations).toHaveLength(1);
      expect(readFileSync(configPath, "utf8")).toBe(old);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("variant_status reports an unknown slug as an error that names it", () =>
    withRuntime(async (directory, configPath) => {
      const result = await mcp([...initMessages(), call(2, "variant_status", { slug: "ghost" })], configPath, {
        cwd: directory,
      });

      expect(answer(result, 2)).toEqual({ isError: true, text: "Unknown variant: ghost" });
    }));

  it("variant_list with verbose gives each item what variant_status gives", () =>
    withRuntime(async (directory, configPath) => {
      const result = await mcp(
        [...initMessages(), call(2, "variant_list", { verbose: true }), call(3, "variant_status", { slug: "demo" })],
        configPath,
        { cwd: directory },
      );

      expect(JSON.parse(answer(result, 2).text)).toEqual([JSON.parse(answer(result, 3).text)]);
    }));

  it("variant_list without verbose leaves the runtime object out", () =>
    withRuntime(async (directory, configPath) => {
      const result = await mcp([...initMessages(), call(2, "variant_list")], configPath, { cwd: directory });
      const [item] = JSON.parse(answer(result, 2).text);

      expect(item).toMatchObject({ slug: "demo", mode: "watch", log: "/work/_v-demo/variants.watch.log" });
      expect(item.runtime).toBeUndefined();
    }));
});

const logging = (result: McpResult): { level: string; data: unknown }[] =>
  result.lines
    .map((line) => JSON.parse(line) as { method?: string; params?: { level: string; data: unknown } })
    .filter((message) => message.method === "notifications/message")
    .map((message) => message.params as { level: string; data: unknown });

const setLevel = (id: number, level: string): object => ({
  jsonrpc: "2.0",
  id,
  method: "logging/setLevel",
  params: { level },
});

/** PostgreSQL on a closed port, with variant `demo` known from its state file. */
const withUnreachableMcp = async (run: (directory: string, configPath: string) => Promise<void>): Promise<void> => {
  const directory = realpathSync(tempDirectory());
  try {
    const configPath = join(directory, "variants.yaml");
    mkdirSync(join(directory, "_v-demo", ".cache", "variant"), { recursive: true });
    writeFileSync(
      configPath,
      "db:\n  dialect: postgres\n  host: 127.0.0.1\n  port: 1\n  database: app\n  password: s3cret-db\n",
    );
    writeFileSync(join(directory, "_v-demo", ".cache", "variant", "state.yaml"), "slug: demo\n");
    await run(directory, configPath);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
};

describe("MCP logging", () => {
  it("sends warning and not info until the client sets a level", () =>
    withUnreachableMcp(async (directory, configPath) => {
      const result = await mcp([...initMessages(), call(2, "variant_list")], configPath, { cwd: directory });
      const notes = logging(result);
      expect(notes.some((note) => note.level === "warning")).toBe(true);
      expect(notes.some((note) => note.level === "info")).toBe(false);
      const listed = answer(result, 2);
      expect(listed.isError).not.toBe(true);
      expect(listed.text).not.toContain("SELECT");
    }));

  it("sends info and warning but not debug when the client asks for info", () =>
    withUnreachableMcp(async (directory, configPath) => {
      const result = await mcp([...initMessages(), setLevel(2, "info"), call(3, "variant_list")], configPath, {
        cwd: directory,
      });
      const notes = logging(result);
      expect(notes.some((note) => note.level === "info")).toBe(true);
      expect(notes.some((note) => note.level === "warning")).toBe(true);
      expect(notes.some((note) => note.level === "debug")).toBe(false);
    }));

  it("sends trace as a debug notification whose data names trace", () =>
    withUnreachableMcp(async (directory, configPath) => {
      const result = await mcp([...initMessages(), setLevel(2, "debug"), call(3, "variant_list")], configPath, {
        cwd: directory,
      });
      const trace = logging(result).find(
        (note) => note.level === "debug" && JSON.stringify(note.data).includes("trace"),
      );
      expect(trace).toBeDefined();
    }));

  it("drops the warning when the client asks for error", () =>
    withUnreachableMcp(async (directory, configPath) => {
      const result = await mcp([...initMessages(), setLevel(2, "error"), call(3, "variant_list")], configPath, {
        cwd: directory,
      });
      expect(logging(result).some((note) => note.level === "warning")).toBe(false);
    }));

  it("returns variant_create as an error whose text is the contact warning", () =>
    withUnreachableMcp(async (directory, configPath) => {
      const result = await mcp([...initMessages(), call(2, "variant_create", { slug: "demo" })], configPath, {
        cwd: directory,
      });
      const created = answer(result, 2);
      expect(created.isError).toBe(true);
      expect(created.text).toContain("postgres");
      expect(created.text).toContain("app");
      expect(created.text).toContain("127.0.0.1");
      expect(created.text).not.toContain("SELECT");
      expect(created.text).not.toContain("s3cret");
    }));
});
