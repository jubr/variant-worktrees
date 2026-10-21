#!/usr/bin/env node
import { createRequire } from "node:module";
import { parseArgs } from "node:util";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createClient } from "variant-api";
import { commands } from "variant-api/commands";
import { loadConfig } from "variant-config";
import { z } from "zod/v4";

const require = createRequire(import.meta.url);
const { version } = require("../package.json") as { version: string };

const { values } = parseArgs({
  args: process.argv.slice(2),
  options: {
    config: { type: "string" },
  },
  strict: true,
});

const config = loadConfig({
  cwd: process.cwd(),
  configPath: values.config as string | undefined,
});
const client = createClient({
  config,
  worktree: process.env.VARIANT_WORKTREE !== "0",
});
const server = new McpServer({ name: "variant", version });

for (const command of commands) {
  const shape: Record<string, z.ZodType> = {};
  for (const arg of command.args.filter((entry) => !(entry.name in (command.mcpFixed ?? {})))) {
    let schema: z.ZodType = z.string().describe(arg.description);
    if (arg.type === "number") {
      schema = z.number().describe(arg.description);
    } else if (arg.type === "boolean") {
      schema = z.boolean().describe(arg.description);
    }
    shape[arg.name] = arg.required ? schema : schema.optional();
  }

  server.tool(`variant_${command.name}`, command.description, shape, async (params) => {
    try {
      const result = await command.execute(client, { ...params, ...command.mcpFixed });
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
      };
    } catch (error) {
      return {
        content: [{ type: "text" as const, text: error instanceof Error ? error.message : String(error) }],
        isError: true,
      };
    }
  });
}

await server.connect(new StdioServerTransport());
