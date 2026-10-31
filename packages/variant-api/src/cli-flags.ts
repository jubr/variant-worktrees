import type { CommandDefinition } from "./commands.js";

/** A flag of a CLI command, as the CLI parser and the shell completion scripts both need to know it. */
export interface FlagSpec {
  name: string;
  type: "string" | "number" | "boolean";
  short?: string;
  description: string;
}

/** Flags that only the CLI has: they change how a result is printed, not what a command does. */
export const CLI_ONLY_FLAGS: Record<string, FlagSpec[]> = {
  list: [{ name: "table", type: "boolean", description: "Print a table instead of JSON" }],
};

/** Every flag the CLI accepts for a command: its definition's arguments plus the CLI-only flags. */
export const flagSpecsFor = (definition: CommandDefinition): FlagSpec[] => [
  ...definition.args.map(
    (arg): FlagSpec => ({
      name: arg.name,
      type: arg.type,
      ...(arg.short ? { short: arg.short } : {}),
      description: arg.name === "slug" ? "Explicit variant slug; overrides git detection" : arg.description,
    }),
  ),
  ...(CLI_ONLY_FLAGS[String(definition.name)] ?? []),
];
