#!/usr/bin/env node
import { cli, command } from "cleye";
import { type CommandDefinition, commands } from "./commands.js";
import { createClient } from "./index.js";
import { formatTable } from "./table.js";
import type { VariantRecord } from "./types.js";

const redacted = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(redacted);
  }
  if (!value || typeof value !== "object") {
    return value;
  }
  const copy: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    copy[key] = key === "password" && child ? "***" : redacted(child);
  }
  return copy;
};

/** Flags that only the CLI has: they change how a result is printed, not what a command does. */
const CLI_ONLY_FLAGS: Record<string, Record<string, { type: BooleanConstructor; description: string }>> = {
  list: { table: { type: Boolean, description: "Print a table instead of JSON" } },
};

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
    ...Object.entries(CLI_ONLY_FLAGS[String(definition.name)] ?? {}),
  ]);

const runCommand = (definition: CommandDefinition) =>
  command(
    {
      name: String(definition.name),
      help: { description: definition.description },
      parameters: definition.args.some((arg) => arg.name === "slug") ? ["[slug]"] : [],
      flags: flagsFor(definition),
    },
    async (argv) => {
      const flags = argv.flags as Record<string, unknown>;
      const positional = (argv._ as unknown as { slug?: string }).slug;
      const args: Record<string, unknown> = {};
      for (const arg of definition.args) {
        const value = arg.name === "slug" ? (flags.slug ?? positional) : flags[arg.name];
        if (value !== undefined) {
          args[arg.name] = value;
        }
      }
      const client = createClient({ worktree: process.env.VARIANT_WORKTREE !== "0" });
      const result = await definition.execute(client, args);
      if (flags.table === true && definition.name === "list") {
        console.log(formatTable(result as VariantRecord[], client.config().variant.root));
        return;
      }
      console.log(JSON.stringify(redacted(result), null, 2));
    },
  );

try {
  const args = process.argv.slice(2);
  const requested = args.find((arg) => !arg.startsWith("-"));
  if (requested !== undefined && !commands.some((definition) => definition.name === requested)) {
    throw new Error(`Unknown command: ${requested}. Run variant --help for the commands.`);
  }
  await cli(
    {
      name: "variant",
      version: "0.0.1",
      help: {
        description: "Database variants for git worktrees",
      },
      strictFlags: true,
      commands: commands.map(runCommand),
    },
    undefined,
    args.length === 0 ? ["--help"] : args,
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
