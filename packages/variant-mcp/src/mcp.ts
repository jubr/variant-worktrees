#!/usr/bin/env node
import { createRequire } from "node:module";
import { parseArgs } from "node:util";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SetLevelRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { createClient, loadVariantConfig } from "variant-api";
import { commands } from "variant-api/commands";
import { type LogLevel, setLogSink } from "variant-log";
import { z } from "zod/v4";
import { finishEditorLog, sendEditorLog } from "./editor-log.js";
import { loggingData } from "./logging-data.js";

const require = createRequire(import.meta.url);
const { version } = require("../package.json") as { version: string };

const { values } = parseArgs({
  args: process.argv.slice(2),
  options: {
    config: { type: "string" },
  },
  strict: true,
});

const config = loadVariantConfig({
  cwd: process.cwd(),
  configPath: values.config as string | undefined,
});
const client = createClient({
  config,
  worktree: process.env.VARIANT_WORKTREE !== "0",
});
const server = new McpServer({ name: "variant", version }, { capabilities: { logging: {} } });

const MCP_LEVELS = ["debug", "info", "notice", "warning", "error", "critical", "alert", "emergency"] as const;
type McpLevel = (typeof MCP_LEVELS)[number];
let clientLevel: McpLevel | undefined;

const libraryAsMcp = (level: LogLevel): McpLevel => {
  if (level === "trace" || level === "debug") {
    return "debug";
  }
  if (level === "info") {
    return "info";
  }
  if (level === "warn") {
    return "warning";
  }
  return "error";
};

/** Trace is delivered only at client `debug`. Other library levels follow the MCP ordering. */
const levelAllows = (level: LogLevel): boolean => {
  const selected = clientLevel ?? "warning";
  if (level === "trace") {
    return selected === "debug";
  }
  return MCP_LEVELS.indexOf(libraryAsMcp(level)) >= MCP_LEVELS.indexOf(selected);
};

server.server.setRequestHandler(SetLevelRequestSchema, async (request) => {
  const level = request.params.level;
  if ((MCP_LEVELS as readonly string[]).includes(level)) {
    clientLevel = level as McpLevel;
  }
  return {};
});

setLogSink((event) => {
  sendEditorLog(process.cwd(), event);
  if (!levelAllows(event.level)) {
    return;
  }
  void server.sendLoggingMessage({
    level: libraryAsMcp(event.level),
    data: loggingData(event),
  });
});

for (const command of commands) {
  const shape: Record<string, z.ZodType> = {};
  for (const arg of command.args.filter((entry) => !(entry.name in (command.mcpFixed ?? {})))) {
    let schema: z.ZodType = z.string().describe(arg.description);
    if (arg.type === "number") {
      schema = z.number().describe(arg.description);
    } else if (arg.type === "boolean") {
      schema = z.boolean().describe(arg.description);
    } else if (arg.type === "choice" && arg.values && arg.values.length > 0) {
      schema = z.enum(arg.values as [string, ...string[]]).describe(arg.description);
    }
    shape[arg.name] = arg.required ? schema : schema.optional();
  }

  server.registerTool(
    `variant_${command.name}`,
    { description: command.description, inputSchema: z.strictObject(shape) },
    async (params) => {
      try {
        const result = await command.execute(client, { ...params, ...command.mcpFixed });
        await finishEditorLog();
        return {
          content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        await finishEditorLog();
        return {
          content: [{ type: "text" as const, text: error instanceof Error ? error.message : String(error) }],
          isError: true,
        };
      }
    },
  );
}

await server.connect(new StdioServerTransport());
