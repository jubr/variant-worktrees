import type { CommandDefinition } from "variant-api/commands";

/** A flag of a CLI command, as the CLI parser and the shell completion scripts both need to know it. */
export interface FlagSpec {
  name: string;
  type: "string" | "number" | "boolean";
  short?: string;
  description: string;
}

/** The flags of a command: one per argument of its definition. The global output flags are not among them. */
export const flagSpecsFor = (definition: CommandDefinition): FlagSpec[] => [
  ...definition.args.map(
    (arg): FlagSpec => ({
      name: arg.name,
      type: arg.type === "choice" ? "string" : arg.type,
      ...(arg.short ? { short: arg.short } : {}),
      description: arg.name === "slug" ? "Explicit variant slug; overrides git detection" : arg.description,
    }),
  ),
];
