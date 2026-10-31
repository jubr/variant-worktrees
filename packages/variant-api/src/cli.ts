#!/usr/bin/env node
import { cli, command } from "cleye";
import pkg from "../package.json" with { type: "json" };
import { collectArgs } from "./cli-args.js";
import { flagSpecsFor } from "./cli-flags.js";
import { type CommandDefinition, commands } from "./commands.js";
import { completionsCommand, generateCompletions, isShell, listSlugs, SHELLS } from "./completions.js";
import { createClient } from "./index.js";
import { formatTable } from "./table.js";
import type { VariantRecord } from "./types.js";

const { version } = pkg;

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

const flagTypes = { string: String, number: Number, boolean: Boolean } as const;

const flagsFor = (definition: CommandDefinition) =>
  Object.fromEntries(
    flagSpecsFor(definition).map((flag) => [
      flag.name,
      {
        type: flagTypes[flag.type],
        ...(flag.short ? { alias: flag.short } : {}),
        description: flag.description,
      },
    ]),
  );

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
      const args = collectArgs(definition, flags, positional);
      const client = createClient({ worktree: process.env.VARIANT_WORKTREE !== "0" });
      const result = await definition.execute(client, args);
      if (flags.table === true && definition.name === "list") {
        console.log(formatTable(result as VariantRecord[], client.config().variant.root));
        return;
      }
      console.log(JSON.stringify(redacted(result), null, 2));
      const exitCode = (result as { exitCode?: unknown } | undefined)?.exitCode;
      if (typeof exitCode === "number" && exitCode !== 0) {
        process.exitCode = exitCode;
      }
    },
  );

/** CLI-only: prints a shell completion script. It needs no configuration, database, or git, so no client is created. */
const completionsCli = command(
  {
    name: completionsCommand.name,
    help: { description: completionsCommand.description },
    parameters: ["[shell]"],
    flags: { listSlugs: { type: Boolean, description: "Print the slugs of existing variants, one per line" } },
  },
  (argv) => {
    if (argv.flags.listSlugs) {
      const slugs = listSlugs();
      process.stdout.write(slugs.map((slug) => `${slug}\n`).join(""));
      return;
    }
    const shell = argv._.shell;
    if (!isShell(shell)) {
      throw new Error(
        `${shell === undefined ? "Missing shell" : `Unsupported shell: ${shell}`}. Supported shells: ${SHELLS.join(", ")}.`,
      );
    }
    process.stdout.write(generateCompletions(shell));
  },
);

const cliCommandNames = [...commands.map((definition) => String(definition.name)), completionsCommand.name];

try {
  const args = process.argv.slice(2);
  const requested = args.find((arg) => !arg.startsWith("-"));
  if (requested !== undefined && !cliCommandNames.includes(requested)) {
    throw new Error(`Unknown command: ${requested}. Run variant --help for the commands.`);
  }
  await cli(
    {
      name: "variant",
      version,
      help: {
        description: "Database variants for git worktrees",
      },
      strictFlags: true,
      commands: [...commands.map(runCommand), completionsCli],
    },
    undefined,
    args.length === 0 ? ["--help"] : args,
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
