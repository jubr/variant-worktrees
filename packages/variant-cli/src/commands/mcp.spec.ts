/**
 * Specification: openspec/specs/variant-cli/mcp-command/spec.md
 *
 * `variant mcp` from source in a child process, speaking MCP over its standard input and output.
 */
import { describe, expect, it } from "bun:test";
import { mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { runCli } from "../test/cli.js";
import { generateCompletions } from "./completions.js";

const cliPath = join(import.meta.dir, "../cli.ts");

interface Talk {
  stdout: string;
  stderr: string;
  exitCode: number;
  /** The JSON-RPC messages of standard output, in order. */
  messages: { id?: number; result?: Record<string, unknown> }[];
}

const INITIALIZE = [
  {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "test", version: "1.0.0" } },
  },
  { jsonrpc: "2.0", method: "notifications/initialized" },
];

const TOOLS = { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} };
const CONFIG = { jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "variant_config", arguments: {} } };

/** Starts `variant <args>` in `cwd`, feeds it `messages` and waits for it to end with its input. */
const talk = async (args: string[], messages: object[], cwd: string): Promise<Talk> => {
  const input = `${messages.map((message) => JSON.stringify(message)).join("\n")}\n`;
  const { FORCE_COLOR: _color, ...inherited } = process.env;
  const proc = Bun.spawn(["bun", "run", cliPath, ...args], {
    cwd,
    env: { ...inherited, NO_COLOR: "1", VARIANT_WORKTREE: "0", VARIANT_OPEN: "0" },
    stdin: new Blob([input]),
    stdout: "pipe",
    stderr: "pipe",
  });
  const [exitCode, stdout, stderr] = await Promise.all([
    proc.exited,
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  const messages_ = stdout
    .split("\n")
    .filter((line) => line.trim() !== "")
    .flatMap((line) => {
      try {
        return [JSON.parse(line)];
      } catch {
        return [];
      }
    });
  return { stdout, stderr, exitCode, messages: messages_ };
};

const toolNames = (result: Talk): string[] =>
  (result.messages.find((message) => message.id === 2)?.result?.tools as { name: string }[]).map((tool) => tool.name);

const configText = (result: Talk): string =>
  ((result.messages.find((message) => message.id === 3)?.result?.content as { text: string }[] | undefined) ?? [])
    .map((part) => part.text)
    .join("\n");

const project = (run: (directory: string) => Promise<void>): Promise<void> => {
  const directory = realpathSync(mkdtempSync(join("/tmp", "variant-cli-mcp-")));
  writeFileSync(join(directory, "variants.yaml"), "db:\n  dialect: sqlite\n");
  return run(directory).finally(() => rmSync(directory, { recursive: true, force: true }));
};

describe("variant mcp", () => {
  it("lists the lifecycle tools over stdio, with no variant_destroy", () =>
    project(async (directory) => {
      const result = await talk(["mcp"], [...INITIALIZE, TOOLS], directory);

      expect(result.exitCode).toBe(0);
      expect(toolNames(result)).toContain("variant_list");
      expect(toolNames(result)).toContain("variant_create");
      expect(toolNames(result)).not.toContain("variant_destroy");
    }));

  it("prints only JSON-RPC messages on standard output", () =>
    project(async (directory) => {
      const result = await talk(["mcp"], [...INITIALIZE, TOOLS], directory);
      const lines = result.stdout.split("\n").filter((line) => line.trim() !== "");

      expect(lines.length).toBeGreaterThan(0);
      expect(result.messages).toHaveLength(lines.length);
      for (const message of result.messages) {
        expect(message).toHaveProperty("jsonrpc", "2.0");
      }
    }));

  it("loads the configuration named by --config from another directory", () =>
    project(async (directory) => {
      const elsewhere = realpathSync(mkdtempSync(join("/tmp", "variant-cli-mcp-cwd-")));
      try {
        const result = await talk(
          ["mcp", "--config", join(directory, "variants.yaml")],
          [...INITIALIZE, CONFIG],
          elsewhere,
        );

        expect(configText(result)).toContain(directory);
      } finally {
        rmSync(elsewhere, { recursive: true, force: true });
      }
    }));

  it("changes to the directory of -C first", () =>
    project(async (directory) => {
      const elsewhere = realpathSync(mkdtempSync(join("/tmp", "variant-cli-mcp-cwd-")));
      try {
        const result = await talk(["-C", directory, "mcp"], [...INITIALIZE, CONFIG], elsewhere);

        expect(configText(result)).toContain(directory);
      } finally {
        rmSync(elsewhere, { recursive: true, force: true });
      }
    }));

  it("fails on an unknown option with nothing on standard output", () =>
    project(async (directory) => {
      const result = await talk(["mcp", "--nope"], INITIALIZE, directory);

      expect(result.exitCode).not.toBe(0);
      expect(result.stdout).toBe("");
      expect(result.stderr).not.toBe("");
    }));

  it("starts the same server with --json, --yaml and --log-level", () =>
    project(async (directory) => {
      for (const flags of [["--json"], ["--yaml"], ["--log-level", "debug"]]) {
        const result = await talk(["mcp", ...flags], [...INITIALIZE, TOOLS], directory);

        expect(toolNames(result)).toContain("variant_list");
      }
    }));

  it("writes no CLI bookkeeping to standard error", () =>
    project(async (directory) => {
      const result = await talk(["mcp", "--log-level", "debug"], [...INITIALIZE, TOOLS], directory);

      expect(result.stderr).not.toContain("cli end");
      expect(result.stderr).not.toContain("ipc");
    }));

  it("is listed in the help, has its own help with --config, and is completed", async () => {
    const top = await runCli(["--help"]);
    const help = await runCli(["mcp", "--help"]);

    expect(top.stdout).toContain("mcp");
    expect(help.exitCode).toBe(0);
    expect(help.stdout).toContain("--config");
    for (const shell of ["bash", "zsh", "fish"] as const) {
      expect(generateCompletions(shell)).toContain("mcp");
    }
  });
});
