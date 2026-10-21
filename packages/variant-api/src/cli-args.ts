import type { CommandDefinition } from "./commands.js";

/**
 * The arguments `execute()` receives for a command line: every flag the definition declares that was given, and the
 * slug from `--slug`, or else from the positional argument.
 */
export const collectArgs = (
  definition: CommandDefinition,
  flags: Record<string, unknown>,
  positional?: string,
): Record<string, unknown> => {
  const args: Record<string, unknown> = {};
  for (const arg of definition.args) {
    const value = arg.name === "slug" ? (flags.slug ?? positional) : flags[arg.name];
    if (value !== undefined) {
      args[arg.name] = value;
    }
  }
  return args;
};
