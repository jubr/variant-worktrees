import type { CommandDefinition } from "variant-api/commands";

/**
 * The arguments `execute()` receives for a command line: every flag the definition declares that was given, and the
 * global slug when the definition takes one. A command that takes no slug ignores it.
 */
const flagOf = (name: string): string => name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);

export const collectArgs = (
  definition: CommandDefinition,
  flags: Record<string, unknown>,
  slug?: string,
): Record<string, unknown> => {
  const args: Record<string, unknown> = {};
  for (const arg of definition.args) {
    const value = arg.name === "slug" ? slug : flags[arg.name];
    if (value !== undefined) {
      if (arg.type === "choice" && !(arg.values ?? []).includes(String(value))) {
        throw new Error(`--${flagOf(arg.name)} must be one of ${(arg.values ?? []).join(", ")}.`);
      }
      args[arg.name] = value;
    }
  }
  return args;
};
