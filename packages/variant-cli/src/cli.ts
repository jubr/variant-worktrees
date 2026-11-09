#!/usr/bin/env node
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { cli, command } from "cleye";
import { createClient, listSlugs } from "variant-api";
import { type CommandDefinition, commands } from "variant-api/commands";
import pkg from "../package.json" with { type: "json" };
import { collectArgs } from "./cli-args.js";
import { flagSpecsFor } from "./cli-flags.js";
import { completionsCommand, generateCompletions, isShell, SHELLS } from "./completions.js";
import { renderHelp } from "./help.js";
import { attachLogLevel, explicitSlug, finishCliLog, takeLogLevel } from "./log-level.js";
import { migrateConfigFiles } from "./migration.js";
import { GLOBAL_FLAGS, type OutputFormat, renderOutput } from "./output.js";
import { CLI_ONLY_COMMANDS, uiCommand } from "./ui.js";
import { platformToken, renderVersion, resolveVersionFacts, versionColor } from "./version-line.js";
import { printWarnings } from "./warnings.js";

const { version } = pkg;

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
      printWarnings(client.config().warnings);
      migrateConfigFiles(client.config());
      const result = await definition.execute(client, args);
      console.log(
        renderOutput(String(definition.name), result, {
          format,
          variantRoot: client.config().variant.root,
          verbose: flags.verbose === true,
        }),
      );
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
    help: { description: completionsCommand.description, render: renderHelp },
    parameters: ["[shell]"],
    flags: { listSlugs: { type: Boolean, description: "Print the slugs of existing variants, one per line" } },
  },
  (argv) => {
    if (argv.flags.listSlugs) {
      process.stdout.write(
        listSlugs()
          .map((slug) => `${slug}\n`)
          .join(""),
      );
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
  const { args: withoutLevel, level } = takeLogLevel(process.argv.slice(2));
  const slug = explicitSlug(withoutLevel);
  attachLogLevel(level, { directory: process.cwd(), ...(slug === undefined ? {} : { slug }) });
  const { args, format } = takeFormat(withoutLevel);
  const requested = args.find((arg) => !arg.startsWith("-"));
  const known = (name: string): boolean =>
    commands.some((definition) => definition.name === name) ||
    (CLI_ONLY_COMMANDS as readonly string[]).includes(name) ||
    name === completionsCommand.name;
  if (requested !== undefined && !known(requested)) {
    throw new Error(`Unknown command: ${requested}. Run variant --help for the commands.`);
  }
  if (args.includes("--version") && requested === undefined) {
    const directory = dirname(fileURLToPath(import.meta.url));
    const facts = resolveVersionFacts(directory, new Date());
    process.stdout.write(
      renderVersion({
        version,
        platform: platformToken(process.platform, process.arch),
        date: facts.date,
        variant: facts.variant,
        banner: process.stdout.isTTY === true,
        color: versionColor({ isTTY: process.stdout.isTTY === true, NO_COLOR: process.env.NO_COLOR }),
      }),
    );
  } else {
    await cli(
      {
        name: "variant",
        version,
        help: {
          description: "Database variants for git worktrees",
          render: renderHelp,
        },
        strictFlags: true,
        commands: [...commands.map((definition) => runCommand(definition, format)), uiCommand(), completionsCli],
      },
      undefined,
      args.length === 0 ? ["--help"] : args,
    );
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  await finishCliLog();
}
