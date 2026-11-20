import { command } from "cleye";
import pkg from "../../package.json" with { type: "json" };
import { renderHelp } from "../help.js";

/** The description and flags of `variant mcp`, shared by the command and the shell completion scripts. */
export const MCP_DESCRIPTION = "Start the MCP server on standard input and output";
export const MCP_FLAGS = {
  config: { type: String, description: "Path of the variants.yaml to load; omitted, the working directory's is used" },
} as const;

/**
 * `variant mcp`: the stdio MCP server of `variant-mcp`, started in-process. Standard output belongs to the protocol,
 * so nothing else may write to it, and the server's own log sink replaces the CLI's (see `cli.ts`).
 *
 * AIDEV-NOTE: the server is loaded on demand so that the other commands do not evaluate the MCP SDK at startup.
 */
export const mcpCommand = () =>
  command(
    {
      name: "mcp",
      help: {
        description: MCP_DESCRIPTION,
        render: renderHelp,
      },
      flags: MCP_FLAGS,
    },
    async (argv) => {
      const { runMcpServer } = await import("variant-mcp");
      const config = argv.flags.config;
      await runMcpServer({ args: config === undefined ? [] : ["--config", config], version: pkg.version });
    },
  );
