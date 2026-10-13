import { describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
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

function mcp(messages: object[], configPath: string): Promise<McpResult> {
  const input = `${messages.map((message) => JSON.stringify(message)).join("\n")}\n`;
  return new Promise((resolve) => {
    const proc = Bun.spawn(["bun", "run", "src/mcp.ts", "--config", configPath], {
      cwd: `${import.meta.dir}/..`,
      env: { ...process.env, VARIANT_WORKTREE: "0" },
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
        "variant_down",
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
});
