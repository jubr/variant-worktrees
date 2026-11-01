#!/usr/bin/env node
import { cli, command } from "cleye";
import pkg from "../package.json" with { type: "json" };
import { collectArgs } from "./cli-args.js";
import { type CommandDefinition, commands } from "./commands.js";
import { renderHelp } from "./help.js";
import { createClient } from "./index.js";
import { GLOBAL_FLAGS, type OutputFormat, renderOutput } from "./output.js";

const { version } = pkg;

const flagTypes = { string: String, number: Number, boolean: Boolean } as const;

const flagsFor = (definition: CommandDefinition) =>
  Object.fromEntries([
    ...definition.args.map((arg) => [
      arg.name,
      {
        type: flagTypes[arg.type],
        ...(arg.short ? { alias: arg.short } : {}),
        description: arg.name === "slug" ? "Explicit variant slug; overrides git detection" : arg.description,
      },
    ]),
  ]);

const runCommand = (definition: CommandDefinition, format: OutputFormat) =>
  command(
    {
      name: String(definition.name),
      help: { description: definition.description, render: renderHelp },
      parameters: definition.args.some((arg) => arg.name === "slug") ? ["[slug]"] : [],
      flags: flagsFor(definition),
    },
    async (argv) => {
      const flags = argv.flags as Record<string, unknown>;
      const positional = (argv._ as unknown as { slug?: string }).slug;
      const args = collectArgs(definition, flags, positional);
      const client = createClient({ worktree: process.env.VARIANT_WORKTREE !== "0" });
      const result = await definition.execute(client, args);
      console.log(renderOutput(String(definition.name), result, { format, variantRoot: client.config().variant.root }));
      const exitCode = (result as { exitCode?: unknown } | undefined)?.exitCode;
      if (typeof exitCode === "number" && exitCode !== 0) {
        process.exitCode = exitCode;
      }
    },
  );

/** Takes the global output flags out of the arguments, wherever they stand, and returns the format they ask for. */
const takeFormat = (argv: string[]): { args: string[]; format: OutputFormat } => {
  const asked = GLOBAL_FLAGS.filter(({ name }) => argv.includes(`--${name}`));
  if (asked.length > 1) {
    throw new Error(`Use either ${asked.map(({ name }) => `--${name}`).join(" or ")}, not both.`);
  }
  const flags = GLOBAL_FLAGS.map(({ name }) => `--${name}`);
  return { args: argv.filter((arg) => !flags.includes(arg)), format: (asked[0]?.name ?? "text") as OutputFormat };
};

try {
  const { args, format } = takeFormat(process.argv.slice(2));
  const requested = args.find((arg) => !arg.startsWith("-"));
  if (requested !== undefined && !commands.some((definition) => definition.name === requested)) {
    throw new Error(`Unknown command: ${requested}. Run variant --help for the commands.`);
  }
  await cli(
    {
      name: "variant",
      version,
      help: {
        description: "Database variants for git worktrees",
        render: renderHelp,
      },
      strictFlags: true,
      commands: commands.map((definition) => runCommand(definition, format)),
    },
    undefined,
    args.length === 0 ? ["--help"] : args,
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
