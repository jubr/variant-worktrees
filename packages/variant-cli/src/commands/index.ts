import type { CommandSection } from "variant-api/commands";
import { completionsCli } from "./completions.js";
import { mcpCommand } from "./mcp.js";
import { uiCommand } from "./ui.js";

/** The commands of the CLI that are not in the library's command list, because the library has no use for them. */
export const CLI_ONLY_COMMANDS = ["ui", "mcp", "completions"] as const;

/** The documentation section of {@link CLI_ONLY_COMMANDS}: `docs/guide/cli.md` documents them in full. */
export const CLI_ONLY_SECTION = "cli" satisfies CommandSection;

/** The cleye commands of {@link CLI_ONLY_COMMANDS}. */
export const cliOnlyCommands = () => [uiCommand(), mcpCommand(), completionsCli()];
