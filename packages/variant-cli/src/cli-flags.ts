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
      type: arg.type,
      ...(arg.short ? { short: arg.short } : {}),
      description: arg.name === "slug" ? "Explicit variant slug; overrides git detection" : arg.description,
    }),
  ),
];

/** The description and flags of `variant ui`, shared by the command and the shell completion scripts. */
export const UI_DESCRIPTION = "Serve the variants web page on a local port and print its URL with the token";
export const UI_FLAGS = {
  detach: { type: Boolean, description: "Start the server in the background and return after printing the URL" },
  stop: { type: Boolean, description: "Stop the server of the project" },
} as const;
