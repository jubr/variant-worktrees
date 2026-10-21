import { describe, expect, it } from "bun:test";
import { execFileSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
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
        "variant_config",
        "variant_create",
        "variant_list",
        "variant_switch",
        "variant_provision",
        "variant_up",
        "variant_down",
        "variant_watch",
        "variant_implode",
      ]);
      expect(names).not.toContain("variant_free");
      expect(names).not.toContain("variant_destroy");
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("creates, lists, and implodes a variant through MCP", async () => {
    const directory = tempDirectory();
    const configPath = configFile(directory);
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
      );
      expect(JSON.parse(create.lines.at(-1) ?? "{}").result.isError).not.toBe(true);

      const list = await mcp(
        [
          ...initMessages(),
          { jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "variant_list", arguments: {} } },
        ],
        configPath,
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

      expect(properties("variant_watch")).toEqual(["slug", "verbose"]);
      expect(properties("variant_implode")).toContain("force");
    } finally {
      rmSync(directory, { recursive: true, force: true });
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
          "  instances:",
          "    be:",
          "      kind: nestjs",
          "      dir: be",
          "      open: http://{{slug}}.vw.localhost:{{port}}",
          "      container: { image: app, port: 3000 }",
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
      expect(up.instances.be).toEqual({
        port: expect.any(Number),
        url: `http://test-feature.vw.localhost:${up.instances.be.port}`,
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
        "db:\n  dialect: sqlite\nvariant:\n  open: false\n  instances:\n    be: { kind: nestjs, dir: be, watch: 'sleep 300' }\n",
      );

      const watched = answer(
        await mcp([...initMessages(), call(3, "variant_watch", { slug: "test-feature" })], configPath, {
          cwd: directory,
        }),
        3,
      );
      const watch = JSON.parse(watched.text);
      const pid = watch.instances.be.pid as number;
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
