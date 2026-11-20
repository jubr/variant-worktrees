import { completionsCli } from "./completions.js";
import { uiCommand } from "./ui.js";

/** The commands of the CLI that are not in the library's command list, because the library has no use for them. */
export const CLI_ONLY_COMMANDS = ["ui", "completions"] as const;

/** The cleye commands of {@link CLI_ONLY_COMMANDS}. */
export const cliOnlyCommands = () => [uiCommand(), completionsCli()];
