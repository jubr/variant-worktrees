/**
 * Specification: openspec/specs/variant-cli/mcp-command/spec.md
 *
 * The stdio MCP server. Nothing runs on import: `variant mcp` and the extension's bundled script call
 * {@link runMcpServer}.
 */
import { parseArgs } from "node:util";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SetLevelRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { createVariantClient, loadVariantConfig } from "variant-api";
import { commands } from "variant-api/commands";
import { LogLevel, setLogSink } from "variant-log";
import { z } from "zod/v4";
import { finishEditorLog, sendEditorLog } from "./editor-log.js";
import { loggingData } from "./logging-data.js";

const MCP_LEVELS = ["debug", "info", "notice", "warning", "error", "critical", "alert", "emergency"] as const;
type McpLevel = (typeof MCP_LEVELS)[number];

const libraryAsMcp = (level: LogLevel): McpLevel => {
  if (level === LogLevel.trace || level === LogLevel.debug) {
    return "debug";
  }
  if (level === LogLevel.info) {
    return "info";
  }
  if (level === LogLevel.warn) {
    return "warning";
  }
  return "error";
};

/** What `variant mcp` and the bundled extension script pass in. */
export interface McpServerOptions {
  /** The arguments after the command name: `--config <path>` is the only option. */
  args: string[];
  /** The version the server reports to its client. */
  version: string;
  /** The directory the configuration is loaded from, and the project the editor log goes to. Default: the working directory. */
  cwd?: string;
}

/**
 * Loads the configuration, registers one tool per command and connects the stdio transport. Resolves once the transport
 * is connected; the process then lives as long as standard input is open. Rejects on an unknown option, before any
 * server exists.
 */
export const runMcpServer = async ({ args, version, cwd = process.cwd() }: McpServerOptions): Promise<void> => {
  const { values } = parseArgs({
    args,
    options: {
      config: { type: "string" },
    },
    strict: true,
  });

  const config = loadVariantConfig({
    cwd,
    configPath: values.config as string | undefined,
  });
  const client = createVariantClient({
    config,
    worktree: process.env.VARIANT_WORKTREE !== "0",
  });
  const server = new McpServer({ name: "variant", version }, { capabilities: { logging: {} } });

  let clientLevel: McpLevel | undefined;

  /** Trace is delivered only at client `debug`. Other library levels follow the MCP ordering. */
  const levelAllows = (level: LogLevel): boolean => {
    const selected = clientLevel ?? "warning";
    if (level === LogLevel.trace) {
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
    sendEditorLog(cwd, event);
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
};
